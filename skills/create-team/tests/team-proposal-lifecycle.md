# Team Proposal Lifecycle

This contract proves the create-team workflow examples still match the CLI-backed proposal lifecycle.

```json skill-test
{
  "name": "team proposal lifecycle",
  "steps": [
    {
      "run": [
        "team",
        "proposal",
        "create",
        "--json-input",
        "{\"businessType\":\"affiliate_marketing\",\"requestedBy\":\"founder\",\"sourceAgentId\":\"main\",\"ideaBrief\":{\"focus\":\"affiliate content engine\",\"targetCustomer\":\"home office shoppers\",\"primaryGoal\":\"ship weekly revenue-generating content\",\"constraints\":\"low spend and proven channels only\"}}"
      ],
      "captureLatestProposalId": true,
      "expect": {
        "companyProposalCount": 1
      }
    },
    {
      "run": [
        "team",
        "proposal",
        "approve",
        "--proposal-id",
        "$LATEST_PROPOSAL_ID",
        "--note",
        "Looks good"
      ],
      "expect": {
        "companyProposalStates": [
          {
            "approvalStatus": "approved"
          }
        ]
      }
    },
    {
      "run": [
        "team",
        "proposal",
        "execute",
        "--proposal-id",
        "$LATEST_PROPOSAL_ID"
      ],
      "expect": {
        "companyProjectIdsInclude": ["proj-affiliate-content-engine-team"],
        "companyProposalStates": [
          {
            "approvalStatus": "approved",
            "executionStatus": "created"
          }
        ],
        "openclawAgentIdsInclude": ["affiliate-content-engine-team-pm", "affiliate-content-engine-team-executor"]
      }
    }
  ]
}
```
