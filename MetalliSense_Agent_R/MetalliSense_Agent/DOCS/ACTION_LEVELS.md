# Voice action levels

Safe calculations and the explicitly requested reading/gate check use ASK with a two-second cancellation window. Device state changes and simulated meter writes retain RUN yes/no. Every existing APPROVE role remains unchanged.

| Page | Action | Level | Confirmation | Roles |
|---|---|---|---|---|
| * | test-action | RUN | yes/no; no plant effects | - |
| /agent | agent_analyze | ASK | 2 s voice/tap Cancel; no yes/no | - |
| /agent | agent_explain | ASK | 2 s voice/tap Cancel; no yes/no | - |
| /anomaly | clear_chat | APPROVE | passcode + 5 s Cancel; confirmation word where registered | Supervisor, Manager |
| /anomaly | deviation_analyze | ASK | 2 s voice/tap Cancel; no yes/no | - |
| /anomaly | deviation_explain | ASK | 2 s voice/tap Cancel; no yes/no | - |
| /cost-analysis | edit_prices | APPROVE | passcode + 5 s Cancel; confirmation word where registered | Manager |
| /energy | energy_meter | RUN | yes/no | - |
| /full-analysis | accept_strategy | APPROVE | passcode + 5 s Cancel | Supervisor, Manager |
| /full-analysis | full_analysis | ASK | 2 s voice/tap Cancel; no yes/no | - |
| /grades | create_grade | APPROVE | passcode + 5 s Cancel; confirmation word where registered | Manager |
| /grades | delete_grade | APPROVE | passcode + 5 s Cancel; confirmation word where registered | Supervisor, Manager |
| /grades | edit_grade | APPROVE | passcode + 5 s Cancel; confirmation word where registered | Manager |
| /inventory-forecast | approve_pr | APPROVE | passcode + 5 s Cancel | Manager |
| /inventory-forecast | create_pr | APPROVE | passcode + 5 s Cancel; confirmation word where registered | Operator, Supervisor |
| /inventory-forecast | reject_pr | APPROVE | passcode + 5 s Cancel | Manager |
| /mechanical-properties | approve_tap | APPROVE | passcode + 5 s Cancel | Supervisor, Manager |
| /mechanical-properties | mechanical_predict | ASK | 2 s voice/tap Cancel; no yes/no | - |
| /premelt-gate | edit_charge | APPROVE | passcode + 5 s Cancel; confirmation word where registered | Operator, Supervisor |
| /premelt-gate | gate_check | ASK | 2 s voice/tap Cancel; no yes/no | - |
| /premelt-gate | override_start | APPROVE | passcode + 5 s Cancel; confirmation word where registered | Unit Controller |
| /premelt-gate | plan_heat | APPROVE | passcode + 5 s Cancel; confirmation word where registered | Operator, Supervisor |
| /premelt-gate | reset_demo | APPROVE | passcode + 5 s Cancel; confirmation word where registered | Manager |
| /premelt-gate | start_melting | APPROVE | passcode + 5 s Cancel | Supervisor,Unit Controller |
| /raw-material-stock | approve_dri_qa | APPROVE | passcode + 5 s Cancel | Supervisor,Manager |
| /raw-material-stock | dri_entry | APPROVE | passcode + 5 s Cancel; confirmation word where registered | Operator, Supervisor |
| /raw-material-stock | receive_alloy | APPROVE | passcode + 5 s Cancel; confirmation word where registered | Operator, Supervisor |
| /raw-material-stock | receive_lot | APPROVE | passcode + 5 s Cancel; confirmation word where registered | Operator, Supervisor |
| /raw-material-stock | reject_dri_qa | APPROVE | passcode + 5 s Cancel | Supervisor,Manager |
| /raw-material-stock | reject_lot | APPROVE | passcode + 5 s Cancel; confirmation word where registered | Manager |
| /raw-material-stock | release_lot | APPROVE | passcode + 5 s Cancel; confirmation word where registered | Manager |
| /recommendation | clear_chat | APPROVE | passcode + 5 s Cancel; confirmation word where registered | Supervisor, Manager |
| /recommendation | correction_explain | ASK | 2 s voice/tap Cancel; no yes/no | - |
| /recommendation | correction_plan | ASK | 2 s voice/tap Cancel; no yes/no | - |
| /rl-optimizer | accept_strategy | APPROVE | passcode + 5 s Cancel | Supervisor, Manager |
| /sales | issue_invoice | APPROVE | passcode + 5 s Cancel; confirmation word where registered | Manager |
| /semantic-search | semantic_search | ASK | 2 s voice/tap Cancel; no yes/no | - |
| /spectrometer | delete_reading | APPROVE | passcode + 5 s Cancel; confirmation word where registered | Supervisor, Manager |
| /spectrometer | opc_connect | APPROVE | passcode + 5 s Cancel | Supervisor,Unit Controller |
| /spectrometer | opc_disconnect | APPROVE | passcode + 5 s Cancel | Supervisor,Unit Controller |
| /spectrometer | request_reading | ASK | 2 s voice/tap Cancel; no yes/no | - |
| /supplier-scorecard | apply_ahp | APPROVE | passcode + 5 s Cancel; confirmation word where registered | Manager |
| /supplier-scorecard | apply_weights | APPROVE | passcode + 5 s Cancel; confirmation word where registered | Manager |
| /supplier-scorecard | supplier_plan | ASK | 2 s voice/tap Cancel; no yes/no | - |
| /training-data | create_training | APPROVE | passcode + 5 s Cancel; confirmation word where registered | Supervisor, Manager |
| /training-data | delete_training | APPROVE | passcode + 5 s Cancel; confirmation word where registered | Supervisor, Manager |
| /training-data | edit_training | APPROVE | passcode + 5 s Cancel; confirmation word where registered | Supervisor, Manager |
| /yard-inspection | gun_connect | RUN | yes/no | - |
| /yard-inspection | gun_disconnect | RUN | yes/no | - |
| /yard-inspection | inspect_lot | APPROVE | passcode + 5 s Cancel | Supervisor |
| /yard-inspection | replace_argon | APPROVE | passcode + 5 s Cancel; confirmation word where registered | Operator, Supervisor |

## Shared page controls

All are ASK, with no confirmation, behind VITE_VOICE_EVERYWHERE. The target must exist on the current page.

| Control | Level | Target |
|---|---|---|
| Go to page / go back | ASK | Routed page / browser history |
| Select / open row | ASK | Loaded heat, PR, lot, grade, reading, supplier or invoice |
| Next / previous row | ASK | Visible loaded rows |
| Read this row | ASK | Current selected row |
| Open tab | ASK | Existing page tab |
| Scroll down / up | ASK | Main page content |
| Refresh | ASK | Existing refresh handler or browser reload |
