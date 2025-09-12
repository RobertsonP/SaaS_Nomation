# APPROVAL GATES SYSTEM
## Mandatory User Approval Before Implementation

### GATE 1: REQUIREMENTS APPROVAL (MANDATORY)

**BEFORE ANY TECHNICAL WORK:**

**REQUIREMENT UNDERSTANDING CHECKLIST:**
- [ ] Business problem clearly understood
- [ ] User needs identified in ordinary language  
- [ ] Success criteria defined from user perspective
- [ ] Scope boundaries established (what's NOT included)
- [ ] Edge cases and error conditions considered

**USER APPROVAL REQUIRED:**
```
USER APPROVAL GATE 1: REQUIREMENTS
Do you approve that I understand the business requirements correctly?
[ ] YES - Proceed to approach discussion
[ ] NO - Need more requirement clarification
```

### GATE 2: BUSINESS APPROACH APPROVAL (MANDATORY)

**BEFORE ANY IMPLEMENTATION PLANNING:**

**BUSINESS APPROACH DISCUSSION:**
- [ ] Solution explained in business terms (no technical jargon)
- [ ] User benefits clearly articulated
- [ ] Business value proposition defined
- [ ] User experience impact described
- [ ] Alternative approaches considered if applicable

**USER APPROVAL REQUIRED:**
```
USER APPROVAL GATE 2: BUSINESS APPROACH
Do you approve the business approach for solving this problem?
[ ] YES - Proceed to implementation method discussion  
[ ] NO - Need different business approach
```

### GATE 3: IMPLEMENTATION METHOD APPROVAL (MANDATORY)

**BEFORE ANY CODING BEGINS:**

**IMPLEMENTATION DISCUSSION:**
- [ ] Implementation method explained in ordinary language
- [ ] Time estimate provided with buffers
- [ ] Risk areas identified with mitigation plans
- [ ] Testing strategy defined
- [ ] User verification method established

**USER APPROVAL REQUIRED:**
```
USER APPROVAL GATE 3: IMPLEMENTATION METHOD
Do you approve HOW I will implement this solution?
[ ] YES - Begin systematic implementation
[ ] NO - Need different implementation approach
```

### GATE 4: COMPONENT COMPLETION APPROVAL (PER COMPONENT)

**BEFORE MARKING ANY COMPONENT COMPLETE:**

**COMPONENT VERIFICATION:**
- [ ] Component actually tested and working
- [ ] User has tested component if applicable
- [ ] Integration with existing system verified
- [ ] No regressions introduced
- [ ] Business value delivered as promised

**USER APPROVAL REQUIRED:**
```
USER APPROVAL GATE 4: COMPONENT COMPLETION
Have you tested this component and does it work as expected?
[ ] YES - Component approved as complete
[ ] NO - Need fixes before marking complete
```

### GATE 5: FINAL COMPLETION APPROVAL (MANDATORY)

**BEFORE MARKING ENTIRE TASK COMPLETE:**

**FINAL VERIFICATION:**
- [ ] All components working together
- [ ] User has performed real usage testing
- [ ] All requirements met and verified
- [ ] No broken functionality remaining
- [ ] User satisfied with solution

**USER APPROVAL REQUIRED:**
```
USER APPROVAL GATE 5: FINAL COMPLETION
Is this task completely done to your satisfaction?
[ ] YES - Task approved as complete
[ ] NO - Need additional work before complete
```

### ENFORCEMENT RULES

**IMPLEMENTATION BLOCKING:**
- Cannot proceed to next phase without user approval
- Cannot mark todos complete without user verification
- Cannot claim "done" without user testing and approval
- Cannot skip gates or bypass approval requirements

**APPROVAL TRACKING:**
- All approvals must be explicit (user says "YES")  
- Assumptions are not approvals
- Silence is not approval
- Must get fresh approval for any scope changes

### GATE VIOLATION CONSEQUENCES

**IF IMPLEMENTATION STARTS WITHOUT APPROVAL:**
1. Stop all implementation immediately
2. Return to requirements/approach discussion
3. Get proper approvals before proceeding
4. Document the workflow violation for learning

**IF COMPLETION CLAIMED WITHOUT USER TESTING:**
1. Mark item as NOT complete
2. Require user testing and explicit approval
3. Fix any issues found during user testing
4. Only mark complete after user verification

### BUSINESS PARTNERSHIP LANGUAGE

**GATE COMMUNICATION STYLE:**
- Use collaborative "we" language
- Frame as business partnership decisions
- Explain benefits and value clearly
- Ask questions to confirm understanding
- Respect user's business judgment

**EXAMPLE GATE LANGUAGE:**
```
"Before we proceed with implementation, I want to make sure we're aligned on the business approach. 

The way I understand it, users are struggling with [business problem] and this solution will help them by [user benefit]. The business value is [value proposition].

Does this approach match your vision for how this should work for your customers?

If yes, I'll proceed to discuss HOW we implement this. If no, let's talk about what approach would be better."
```

### CURRENT SESSION GATE STATUS

**GATES PASSED THIS SESSION:**
- [ ] Gate 1: Requirements Approved
- [ ] Gate 2: Business Approach Approved  
- [ ] Gate 3: Implementation Method Approved
- [ ] Gate 4: Components Approved (as completed)
- [ ] Gate 5: Final Completion Approved

**NEXT REQUIRED GATE:** User must activate partner mode to begin gate system