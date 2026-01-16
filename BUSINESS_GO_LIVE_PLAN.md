# SaaS Nomation: Master "Go-Live" Strategic Plan
**Status:** Approved for Execution
**Focus:** Commercialization & Infrastructure Scale
**Target Launch:** Q2 2026

## 1. Executive Strategy: The "Bridge" Approach

We are launching with a **Hybrid Strategy** designed to capture immediate user feedback (Option A) while building the infrastructure for high-value enterprise contracts (Option B).

*   **Phase 1 (Alpha):** "The Developer's Companion." Focus on solo devs/freelancers. Local uploads, low barrier to entry. Privacy-first messaging ("Your code stays local-ish").
*   **Phase 2 (Beta):** "The Team's QA Engine." GitHub Integration, **CI/CD Pipeline Drops**, Team Management.
*   **Phase 3 (Scale):** "The Enterprise Standard." Mid-market adoption, SLA-backed execution, On-premise options.

---

## 2. Market Validation (The Data)

### 2.1 The Opportunity Size
*   **TAM (Total Addressable Market):** The global automation testing market is projected to reach **$35.29 Billion** by 2025 (CAGR ~16.8%).
*   **SAM (Serviceable Addressable Market):** The **AI-Enabled Testing** segment is ~**$1 Billion** (2025), growing at **20%+**. This is our playground.
*   **SOM (Serviceable Obtainable Market):** Aiming for 0.01% of the SAM in Year 1 = **$100k ARR**.

### 2.2 Competitor Benchmarks (The Ceiling)
*   **Tricentis (Enterprise Leader):** $425M+ ARR. Valuation $4.5B.
*   **Mabl (Low-Code Rival):** ~$35M ARR.
*   **Cypress (Dev-Tool Rival):** ~$20M ARR.
*   **Testim (AI Rival):** Acquired for **$200M** with only ~$2M ARR.
    *   *Insight:* The market pays massive multiples (100x) for AI testing tech that works. This validates our "Smart Analysis" approach.

---

## 3. Product Realization Roadmap (Technical & Feature Scope)

### 3.1 The MVP Boundary (Day 1 Requirements)
To launch, we strictly enforce this scope.

| Feature Area | Day 1 Requirement (MVP) | Implementation Status |
| :--- | :--- | :--- |
| **Input Methods** | **Dual Mode:** <br>1. Local Folder Upload.<br>2. GitHub Repo Import. | ✅ Folder Upload (Partial)<br>🚧 GitHub Service (In Progress) |
| **Analysis Engine** | Auto-detect Framework, Sitemap Discovery, AST Extraction. | ✅ Implemented (`ProjectAnalyzerService`) |
| **CI/CD Integration**| **Critical:** Trigger tests via Webhook/CLI on Commit. | 🛑 **Missing** (Priority High) |
| **Test Execution** | Headless Playwright runner with **Video & Screenshot**. | ✅ Implemented (`ExecutionService`) |
| **Infrastructure** | **Cloud-Ready:** Move to AWS ECS/Fargate. | 🚧 Needs Migration Plan |
| **Billing** | Stripe Subscription + Metered Credits. | ✅ Basic Integration Exists |

### 3.2 The "White Box" Advantage (UVP)
Our differentiator against Mabl (Black Box) and Cypress (Manual Code):
*"We read your code's AST to understand Intent. When you rename a button, we don't break."*

---

## 4. Infrastructure & Architecture (The "Cloud Decision")

### 4.1 Cloud Provider: **AWS (Amazon Web Services)**
*   **Compute:** **ECS Fargate** (Serverless Containers). Scale-to-Zero capability is essential for our margins.
*   **Storage:** **S3** for massive video/screenshot storage.
*   **Queue:** **Amazon SQS** (replacing local Redis) for robust job handling.

### 4.2 CI/CD "Per-Commit" Architecture
We will enable "Run on Commit" via:
1.  **The Trigger:** A GitHub Action (yaml) or Webhook.
2.  **The Flow:**
    *   User pushes code -> GitHub calls `api.nomation.com/v1/trigger` with Commit SHA.
    *   Nomation pulls that specific SHA -> Analyzes -> Runs Tests.
    *   Nomation calls back GitHub API to set Commit Status (✅/❌).

---

## 5. Commercialization & Pricing Model

### 5.1 Hybrid Pricing Strategy (The "LLM Model")
We give users choice: Predictable Subscription OR Flexible Pay-as-you-go.

| Tier | Price | Includes | Target User |
| :--- | :--- | :--- | :--- |
| **Dev (Free)** | $0/mo | 1 Project, 50 Test Runs/mo. | Students, Hobbyists. |
| **Pro (Sub)** | $49/mo | 3 Projects, 500 Test Runs, CI/CD Integration. | Freelancers, Solo Founders. |
| **Team (Sub)** | $199/mo | Unlimited Projects, 5k Runs, Team Sync. | Startups (Seed/Series A). |
| **API (Metered)**| $0.05/run | Pay per execution. | CI/CD Heavy Users. |

---

## 6. Financial Projections (Year 1)

**Unit Economics (Per Test Run):**
*   Compute (Fargate 2vCPU/4GB for 2 mins): ~$0.004
*   Bandwidth/Storage: ~$0.001
*   **Total Cost:** ~$0.005
*   **Price (Metered):** $0.05
*   **Margin:** ~90% (Software margins).

**Revenue Goals:**
*   **Month 6:** $10,000 MRR.
*   **Month 12:** $50,000 MRR.

---

## 7. Immediate Next Steps (The "To-Do")

1.  **CI/CD Implementation (Priority High):** Build the `TriggerController` to handle incoming Webhooks and report status back to GitHub.
2.  **Billing Upgrade:** Implement the `Credits` ledger for Metered usage.
3.  **GitHub Service:** Finish the `importRepository` and OAuth flow.
4.  **Cloud Prep:** Write Terraform for AWS ECS Fargate.