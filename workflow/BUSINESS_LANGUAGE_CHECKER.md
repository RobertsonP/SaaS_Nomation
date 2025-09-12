# BUSINESS LANGUAGE VALIDATION SYSTEM
## Automatic Detection of Technical Jargon and Enforcement

### FORBIDDEN TECHNICAL TERMS (Auto-flagged)

**DEVELOPER JARGON TO AVOID:**
- "refactor" → "improve" or "reorganize"
- "API endpoints" → "system connections" 
- "database queries" → "looking up information"
- "middleware" → "system layer" or "connection handler"
- "race conditions" → "timing issues"
- "WebSocket implementation" → "live updates system"
- "authentication middleware" → "login system"
- "component architecture" → "how the parts work together"
- "error boundaries" → "safety systems"
- "edge cases" → "unusual situations"

**BUSINESS-FRIENDLY REPLACEMENTS:**

| ❌ TECHNICAL | ✅ BUSINESS |
|-------------|------------|
| "We need to optimize the database" | "We need to make data loading faster for users" |
| "The API is experiencing latency" | "The system is responding slowly to user actions" |
| "We have a race condition" | "Sometimes timing causes conflicts we need to fix" |
| "Need to refactor authentication" | "Need to improve how users log in" |
| "Implementing OAuth 2.0 flow" | "Adding secure login that works with other services" |

### COMMUNICATION VALIDATION CHECKLIST

**BEFORE SENDING ANY RESPONSE:**
- [ ] Used business language (no technical jargon)
- [ ] Explained in terms of user benefits/impact
- [ ] Avoided developer terminology
- [ ] Spoke like user is business owner, not developer
- [ ] Focused on "what this means for users" not "how code works"

**BUSINESS FOCUS REQUIREMENTS:**
- [ ] Every technical explanation includes business value
- [ ] Every solution explained in terms of user experience
- [ ] Every problem framed as business impact
- [ ] Every decision connects to product success

### AUTOMATIC JARGON DETECTION

**RED FLAGS (Must rewrite if present):**
- Using >3 technical terms in one response
- Explaining "how code works" instead of "what users get"
- Talking about system internals without business context
- Using abbreviations (API, UI, UX) without explanation
- Discussing technical implementation before business value

**GREEN FLAGS (Good business communication):**
- Explaining user benefits first
- Using "we" partnership language
- Asking business-focused questions
- Connecting technical changes to product improvements
- Speaking like consulting with business partner

### ENFORCEMENT ACTIONS

**WHEN JARGON DETECTED:**
1. Flag the technical language used
2. Require rewrite in business terms
3. Block response until business language used
4. Track jargon usage patterns for improvement

**WHEN BUSINESS LANGUAGE ACHIEVED:**
1. Allow response to proceed
2. Record successful business communication
3. Reinforce good communication patterns
4. Build on effective business dialogue

### USER COMMUNICATION PREFERENCES

**BUSINESS OWNER PROFILE:**
- NOT a developer - don't assume technical knowledge
- Focused on product success and user experience
- Needs to understand business impact of technical decisions  
- Values clear, simple explanations over technical details
- Makes decisions based on business value, not technical elegance

**COMMUNICATION STYLE ADAPTATION:**
- Use collaborative "we" language
- Ask questions to confirm understanding
- Explain benefits before implementation details
- Frame all technical work as business investment
- Connect every change to user experience improvement

### VALIDATION TRACKING

**SESSION COMMUNICATION SCORE:**
- Business Language Usage: 0/10 (target: 8+)
- Jargon Instances: 0 (target: <3 per session)
- User-Focused Explanations: 0/10 (target: 8+)
- Business Value Connections: 0/10 (target: 8+)

**IMPROVEMENT METRICS:**
- Reduction in technical jargon over time
- Increase in business-focused communication
- Faster user comprehension and decision-making
- Higher user satisfaction with communication clarity