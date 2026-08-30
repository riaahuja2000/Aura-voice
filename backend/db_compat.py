"""Async Mongo-like document compatibility layer backed by PostgreSQL/Neon.

Aura Voice's API was originally written against Motor/MongoDB.  This module
implements the small subset of that interface the app uses, while persisting
JSON documents in PostgreSQL.  It lets Vercel Marketplace Neon replace Atlas
without rewriting every API route.
"""
from __future__ import annotations

import base64
import copy
import json
import uuid
from typing import Any, Optional

from psycopg import AsyncConnection
from psycopg.types.json import Jsonb

_BYTES_TAG = "__aura_bytes_b64__"
_TABLE = "aura_documents"


def _encode(value: Any) -> Any:
    if isinstance(value, bytes):
        return {_BYTES_TAG: base64.b64encode(value).decode("ascii")}
    if isinstance(value, dict):
        return {str(k): _encode(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_encode(v) for v in value]
    return value


def _decode(value: Any) -> Any:
    if isinstance(value, dict):
        if set(value.keys()) == {_BYTES_TAG}:
            return base64.b64decode(value[_BYTES_TAG].encode("ascii"))
        return {k: _decode(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_decode(v) for v in value]
    return value


def _value_at(doc: dict, key: str) -> Any:
    cur: Any = doc
    for part in key.split("."):
        if not isinstance(cur, dict) or part not in cur:
            return None
        cur = cur[part]
    return cur


def _matches(doc: dict, query: Optional[dict]) -> bool:
    if not query:
        return True
    for key, expected in query.items():
        actual = _value_at(doc, key)
        if isinstance(expected, dict):
            for op, rhs in expected.items():
                if op == "$in":
                    if actual not in rhs:
                        return False
                elif op == "$ne":
                    if actual == rhs:
                        return False
                elif op == "$exists":
                    exists = _value_at(doc, key) is not None
                    if exists != bool(rhs):
                        return False
                else:
                    return False
        elif actual != expected:
            return False
    return True


def _apply_update(doc: dict, update: dict) -> dict:
    out = copy.deepcopy(doc)
    if any(str(k).startswith("$") for k in update):
        for key, value in update.get("$set", {}).items():
            out[key] = value
        for key, value in update.get("$inc", {}).items():
            out[key] = (out.get(key, 0) or 0) + value
        for key in update.get("$unset", {}).keys():
            out.pop(key, None)
    else:
        out = copy.deepcopy(update)
    return out


class PostgresDocumentClient:
    def __init__(self, url: str):
        self.url = url
        self.admin = _Admin(self)
        self._schema_ready = False

    def __getitem__(self, database_name: str):
        return PostgresDocumentDatabase(self, database_name)

    async def _connect(self) -> AsyncConnection:
        return await AsyncConnection.connect(self.url, autocommit=True)

    async def ensure_schema(self) -> None:
        if self._schema_ready:
            return
        conn = await self._connect()
        try:
            await conn.execute(
                f"""
                CREATE TABLE IF NOT EXISTS {_TABLE} (
                    namespace TEXT NOT NULL,
                    collection TEXT NOT NULL,
                    doc_id TEXT NOT NULL,
                    doc JSONB NOT NULL,
                    PRIMARY KEY (namespace, collection, doc_id)
                )
                """
            )
            await conn.execute(
                f"CREATE INDEX IF NOT EXISTS idx_{_TABLE}_collection "
                f"ON {_TABLE} (namespace, collection)"
            )
            self._schema_ready = True
        finally:
            await conn.close()

    def close(self) -> None:
        # Connections are intentionally short-lived for serverless safety.
        return None


class _Admin:
    def __init__(self, client: PostgresDocumentClient):
        self.client = client

    async def command(self, name: str):
        if str(name).lower() != "ping":
            raise ValueError(f"Unsupported admin command: {name}")
        await self.client.ensure_schema()
        conn = await self.client._connect()
        try:
            cur = await conn.execute("SELECT 1")
            await cur.fetchone()
            return {"ok": 1}
        finally:
            await conn.close()


class PostgresDocumentDatabase:
    def __init__(self, client: PostgresDocumentClient, name: str):
        self.client = client
        self.name = name or "aura_voice"

    def __getattr__(self, collection_name: str):
        if collection_name.startswith("_"):
            raise AttributeError(collection_name)
        return PostgresDocumentCollection(self.client, self.name, collection_name)

    def __getitem__(self, collection_name: str):
        return PostgresDocumentCollection(self.client, self.name, collection_name)


class PostgresDocumentCollection:
    def __init__(self, client: PostgresDocumentClient, namespace: str, name: str):
        self.client = client
        self.namespace = namespace
        self.name = name

    async def _all(self) -> list[dict]:
        await self.client.ensure_schema()
        conn = await self.client._connect()
        try:
            cur = await conn.execute(
                f"SELECT doc FROM {_TABLE} WHERE namespace=%s AND collection=%s",
                (self.namespace, self.name),
            )
            rows = await cur.fetchall()
            return [_decode(copy.deepcopy(row[0])) for row in rows]
        finally:
            await conn.close()

    async def _put(self, doc: dict) -> dict:
        await self.client.ensure_schema()
        stored = copy.deepcopy(doc)
        if not stored.get("_id"):
            stored["_id"] = str(stored.get("id") or uuid.uuid4())
        doc_id = str(stored["_id"])
        conn = await self.client._connect()
        try:
            await conn.execute(
                f"""
                INSERT INTO {_TABLE} (namespace, collection, doc_id, doc)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (namespace, collection, doc_id)
                DO UPDATE SET doc=EXCLUDED.doc
                """,
                (self.namespace, self.name, doc_id, Jsonb(_encode(stored))),
            )
        finally:
            await conn.close()
        return stored

    async def create_index(self, *args, **kwargs):
        await self.client.ensure_schema()
        return kwargs.get("name") or "aura_compat_index"

    async def insert_one(self, doc: dict):
        stored = copy.deepcopy(doc)
        if not stored.get("_id"):
            stored["_id"] = str(stored.get("id") or uuid.uuid4())
        # Match Motor's useful side effect: caller sees generated _id.
        doc.setdefault("_id", stored["_id"])
        await self._put(stored)
        return _InsertOneResult(stored["_id"])

    async def insert_many(self, docs: list[dict]):
        ids = []
        for doc in docs:
            res = await self.insert_one(doc)
            ids.append(res.inserted_id)
        return _InsertManyResult(ids)

    async def find_one(self, query: Optional[dict] = None, sort=None):
        rows = [d for d in await self._all() if _matches(d, query)]
        rows = _sort_rows(rows, sort)
        return copy.deepcopy(rows[0]) if rows else None

    def find(self, query: Optional[dict] = None):
        return PostgresDocumentCursor(self, query or {})

    async def update_one(self, query: dict, update: dict, upsert: bool = False):
        rows = await self._all()
        target = next((d for d in rows if _matches(d, query)), None)
        if target is None:
            if not upsert:
                return _UpdateResult(0, 0)
            target = {
                k: copy.deepcopy(v)
                for k, v in query.items()
                if not isinstance(v, dict)
            }
            if not target.get("_id"):
                target["_id"] = str(target.get("id") or uuid.uuid4())
            modified = _apply_update(target, update)
            await self._put(modified)
            return _UpdateResult(0, 1, upserted_id=modified.get("_id"))
        modified = _apply_update(target, update)
        modified.setdefault("_id", target.get("_id") or str(uuid.uuid4()))
        await self._put(modified)
        return _UpdateResult(1, 1)

    async def delete_many(self, query: Optional[dict] = None):
        matches = [d for d in await self._all() if _matches(d, query)]
        if not matches:
            return _DeleteResult(0)
        await self.client.ensure_schema()
        conn = await self.client._connect()
        try:
            for doc in matches:
                await conn.execute(
                    f"DELETE FROM {_TABLE} WHERE namespace=%s AND collection=%s AND doc_id=%s",
                    (self.namespace, self.name, str(doc.get("_id"))),
                )
        finally:
            await conn.close()
        return _DeleteResult(len(matches))

    async def count_documents(self, query: Optional[dict] = None):
        return sum(1 for d in await self._all() if _matches(d, query))


class PostgresDocumentCursor:
    def __init__(self, collection: PostgresDocumentCollection, query: dict):
        self.collection = collection
        self.query = query
        self._sort = None
        self._skip = 0
        self._limit = None

    def sort(self, key, direction=None):
        if isinstance(key, list):
            self._sort = key
        else:
            self._sort = [(key, direction if direction is not None else 1)]
        return self

    def skip(self, count: int):
        self._skip = max(0, int(count or 0))
        return self

    def limit(self, count: int):
        self._limit = max(0, int(count or 0))
        return self

    async def _materialize(self) -> list[dict]:
        rows = [d for d in await self.collection._all() if _matches(d, self.query)]
        rows = _sort_rows(rows, self._sort)
        if self._skip:
            rows = rows[self._skip:]
        if self._limit is not None:
            rows = rows[: self._limit]
        return [copy.deepcopy(d) for d in rows]

    async def to_list(self, length: Optional[int] = None):
        rows = await self._materialize()
        if length is not None:
            rows = rows[: int(length)]
        return rows

    def __aiter__(self):
        async def _gen():
            for row in await self._materialize():
                yield row
        return _gen()


def _sort_rows(rows: list[dict], spec) -> list[dict]:
    if not spec:
        return rows
    if isinstance(spec, tuple):
        spec = [spec]
    out = list(rows)
    # Stable-sort in reverse field order to emulate multi-column ordering.
    for field, direction in reversed(spec):
        reverse = int(direction or 1) < 0
        out.sort(
            key=lambda d: (_value_at(d, field) is None, _value_at(d, field)),
            reverse=reverse,
        )
    return out


class _InsertOneResult:
    def __init__(self, inserted_id):
        self.inserted_id = inserted_id


class _InsertManyResult:
    def __init__(self, inserted_ids):
        self.inserted_ids = inserted_ids


class _UpdateResult:
    def __init__(self, matched_count, modified_count, upserted_id=None):
        self.matched_count = matched_count
        self.modified_count = modified_count
        self.upserted_id = upserted_id


class _DeleteResult:
    def __init__(self, deleted_count):
        self.deleted_count = deleted_count
