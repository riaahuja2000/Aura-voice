import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "@/src/auth";
import { COLORS } from "@/theme";

export default function Index() {
  const { user, ready } = useAuth();

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.surface, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={COLORS.gold} />
      </View>
    );
  }

  if (user) return <Redirect href={"/home" as any} />;
  return <Redirect href={"/login" as any} />;
}
