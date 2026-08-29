#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: "Build a mobile app: make the most beautiful, out of the box, super fresh and new complete mobile app from end to end so that when voice input is sent, it generates same context output through audio/voice - strictly occult sciences, mindfulness and aura A to Z in the AI knowledge base. No texts in the app only voice input and output."

backend:
  - task: "Voice consult endpoint using Claude Sonnet 4.6"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "Added POST /api/voice/consult that calls Claude Sonnet 4.6 via emergentintegrations LlmChat with a strict system prompt for occult sciences, mindfulness and aura A-Z. Off-topic questions get a graceful spoken redirect. Response is stripped of markdown for pure TTS. Manual smoke test passed: green-aura question returned poetic in-scope 4-sentence answer; car-engine question returned the redirect line."
      - working: true
        agent: "testing"
        comment: "Comprehensive testing completed. All 10 tests PASSED: (1) Customer login successful with token, (2) In-scope English question returned 649-char natural prose answer with NO markdown/bullets, (3) Off-topic car question correctly redirected with 'stars whisper only of occult, mindfulness, aura' message, (4) Hindi question returned proper Devanagari script, (5) Hinglish question returned valid answer, (6) No auth correctly rejected with 401, (7) Empty question correctly rejected with 422, (8) Root endpoint working, (9) /auth/me working with token, (10) /settings endpoint working. Voice consult endpoint is production-ready."

frontend:
  - task: "Voice-only orb home screen with 3 themes"
    implemented: true
    working: "NA"
    file: "frontend/app/(app)/home.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Rewrote home as a text-free voice-only screen. Reactive orb (Reanimated pulse + counter-rotating rings + wobble + glow halo) sits center. Tap orb -> STT -> Claude -> TTS -> back to idle. Long-press orb OR palette icon cycles 3 themes: cosmic nebula, aura flame, silver crescent. Icon-only top bar (theme / owner-shield-if-owner / logout). Ambient twinkling stars. Zero on-screen text. Screenshot verified all three themes render perfectly."
  - task: "Cross-platform STT hook (native + web)"
    implemented: true
    working: "NA"
    file: "frontend/src/voice-stt.ts"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "New hook that uses expo-speech-recognition on native and Web Speech API on the browser preview so the orb tap works everywhere without crashes."
  - task: "Simplified app layout (Stack instead of Tabs)"
    implemented: true
    working: "NA"
    file: "frontend/app/(app)/_layout.tsx"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Removed bottom tab bar entirely (was text-heavy) and replaced with a plain Stack. Owner access is now a small shield icon in the top bar of the orb home."

metadata:
  created_by: "main_agent"
  version: "1.0"
  test_sequence: 2
  run_ui: false

test_plan:
  current_focus:
    - "Voice consult endpoint using Claude Sonnet 4.6"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
  - agent: "main"
    message: "Built a voice-only mystical oracle app. Added POST /api/voice/consult (Claude Sonnet 4.6, occult+mindfulness+aura scope, off-topic redirect). Please test the endpoint with auth token: (1) in-scope English question -> 2-4 sentence poetic answer, no markdown, (2) off-topic question -> exact redirect line, (3) Hindi lang parameter -> Devanagari script answer, (4) unauthenticated call -> 401. Seeded credentials in /app/memory/test_credentials.md."
  - agent: "testing"
    message: "Testing complete. All 10 backend tests PASSED. Voice consult endpoint is working perfectly: authentication, in-scope questions, off-topic redirects, multilingual support (English/Hindi/Hinglish), validation, and all sanity checks passed. No issues found. Ready for production."
