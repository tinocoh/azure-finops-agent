# Q2 FinOps Review � Notes

## Goals
- Cut waste by 12% MoM
- Move 60% of stable VMs onto 1y RIs
- Tag coverage > 95% for cost-center & environment

## Findings
### Finding 1: Premium disk on test workload
- Resource group: `rg-data-eus2`
- Estimated monthly waste: **$455**
- Owner: Platform team
- Action: Add cost-center tag

### Finding 2: Idle VM cluster
- Resource group: `rg-sql-prod`
- Estimated monthly waste: **$178**
- Owner: Platform team
- Action: Right-size next maintenance window

### Finding 3: Premium disk on test workload
- Resource group: `rg-sql-prod`
- Estimated monthly waste: **$307**
- Owner: Cloud CoE
- Action: Right-size next maintenance window

### Finding 4: Missing budget
- Resource group: `rg-ml-train`
- Estimated monthly waste: **$465**
- Owner: ML team
- Action: Apply autoshutdown 19:00 UTC

### Finding 5: Premium disk on test workload
- Resource group: `rg-ml-train`
- Estimated monthly waste: **$540**
- Owner: Data team
- Action: Right-size next maintenance window

### Finding 6: Unattached disks
- Resource group: `rg-network-hub`
- Estimated monthly waste: **$183**
- Owner: Data team
- Action: Right-size next maintenance window

### Finding 7: Unattached disks
- Resource group: `rg-ml-train`
- Estimated monthly waste: **$332**
- Owner: Cloud CoE
- Action: Right-size next maintenance window

### Finding 8: Unattached disks
- Resource group: `rg-network-hub`
- Estimated monthly waste: **$906**
- Owner: Data team
- Action: Move to Standard SSD

### Finding 9: Untagged storage
- Resource group: `rg-ml-train`
- Estimated monthly waste: **$919**
- Owner: ML team
- Action: Add cost-center tag

### Finding 10: Idle VM cluster
- Resource group: `rg-ml-train`
- Estimated monthly waste: **$489**
- Owner: Platform team
- Action: Add cost-center tag

### Finding 11: Unattached disks
- Resource group: `rg-aks-prod`
- Estimated monthly waste: **$326**
- Owner: Cloud CoE
- Action: Move to Standard SSD

### Finding 12: Oversized SQL DB
- Resource group: `rg-platform-weu`
- Estimated monthly waste: **$515**
- Owner: ML team
- Action: Add cost-center tag

### Finding 13: Idle VM cluster
- Resource group: `rg-aks-prod`
- Estimated monthly waste: **$929**
- Owner: ML team
- Action: Add cost-center tag

### Finding 14: Untagged storage
- Resource group: `rg-network-hub`
- Estimated monthly waste: **$931**
- Owner: Cloud CoE
- Action: Move to Standard SSD

### Finding 15: Premium disk on test workload
- Resource group: `rg-aks-prod`
- Estimated monthly waste: **$502**
- Owner: ML team
- Action: Right-size next maintenance window

### Finding 16: Oversized SQL DB
- Resource group: `rg-data-eus2`
- Estimated monthly waste: **$479**
- Owner: Platform team
- Action: Move to Standard SSD

### Finding 17: Unattached disks
- Resource group: `rg-network-hub`
- Estimated monthly waste: **$407**
- Owner: ML team
- Action: Move to Standard SSD

### Finding 18: Premium disk on test workload
- Resource group: `rg-network-hub`
- Estimated monthly waste: **$590**
- Owner: Data team
- Action: Add cost-center tag

### Finding 19: Unattached disks
- Resource group: `rg-data-eus2`
- Estimated monthly waste: **$936**
- Owner: Cloud CoE
- Action: Add cost-center tag

### Finding 20: Unattached disks
- Resource group: `rg-aks-prod`
- Estimated monthly waste: **$754**
- Owner: Data team
- Action: Delete after 7d notice

### Finding 21: Untagged storage
- Resource group: `rg-sql-prod`
- Estimated monthly waste: **$219**
- Owner: Data team
- Action: Move to Standard SSD

### Finding 22: Premium disk on test workload
- Resource group: `rg-platform-weu`
- Estimated monthly waste: **$828**
- Owner: ML team
- Action: Apply autoshutdown 19:00 UTC

### Finding 23: Oversized SQL DB
- Resource group: `rg-mgmt`
- Estimated monthly waste: **$818**
- Owner: Cloud CoE
- Action: Delete after 7d notice

### Finding 24: Unattached disks
- Resource group: `rg-data-eus2`
- Estimated monthly waste: **$70**
- Owner: Cloud CoE
- Action: Delete after 7d notice

### Finding 25: Missing budget
- Resource group: `rg-network-hub`
- Estimated monthly waste: **$682**
- Owner: Data team
- Action: Right-size next maintenance window

### Finding 26: Untagged storage
- Resource group: `rg-ml-train`
- Estimated monthly waste: **$277**
- Owner: Data team
- Action: Move to Standard SSD

### Finding 27: Unattached disks
- Resource group: `rg-platform-weu`
- Estimated monthly waste: **$525**
- Owner: Cloud CoE
- Action: Add cost-center tag

### Finding 28: Unattached disks
- Resource group: `rg-mgmt`
- Estimated monthly waste: **$164**
- Owner: Data team
- Action: Move to Standard SSD

### Finding 29: Missing budget
- Resource group: `rg-ml-train`
- Estimated monthly waste: **$628**
- Owner: Platform team
- Action: Right-size next maintenance window

### Finding 30: Premium disk on test workload
- Resource group: `rg-data-eus2`
- Estimated monthly waste: **$328**
- Owner: Platform team
- Action: Move to Standard SSD

### Finding 31: Unattached disks
- Resource group: `rg-network-hub`
- Estimated monthly waste: **$696**
- Owner: ML team
- Action: Right-size next maintenance window

### Finding 32: Oversized SQL DB
- Resource group: `rg-sql-prod`
- Estimated monthly waste: **$221**
- Owner: Platform team
- Action: Right-size next maintenance window

### Finding 33: Oversized SQL DB
- Resource group: `rg-data-eus2`
- Estimated monthly waste: **$194**
- Owner: ML team
- Action: Add cost-center tag

### Finding 34: Unattached disks
- Resource group: `rg-mgmt`
- Estimated monthly waste: **$620**
- Owner: Data team
- Action: Delete after 7d notice

### Finding 35: Untagged storage
- Resource group: `rg-sql-prod`
- Estimated monthly waste: **$188**
- Owner: Data team
- Action: Delete after 7d notice

### Finding 36: Premium disk on test workload
- Resource group: `rg-ml-train`
- Estimated monthly waste: **$232**
- Owner: Platform team
- Action: Add cost-center tag

### Finding 37: Oversized SQL DB
- Resource group: `rg-mgmt`
- Estimated monthly waste: **$858**
- Owner: Cloud CoE
- Action: Right-size next maintenance window

### Finding 38: Untagged storage
- Resource group: `rg-platform-weu`
- Estimated monthly waste: **$773**
- Owner: Cloud CoE
- Action: Apply autoshutdown 19:00 UTC

### Finding 39: Premium disk on test workload
- Resource group: `rg-mgmt`
- Estimated monthly waste: **$735**
- Owner: ML team
- Action: Move to Standard SSD

### Finding 40: Idle VM cluster
- Resource group: `rg-network-hub`
- Estimated monthly waste: **$443**
- Owner: Cloud CoE
- Action: Apply autoshutdown 19:00 UTC

### Finding 41: Untagged storage
- Resource group: `rg-aks-prod`
- Estimated monthly waste: **$49**
- Owner: Cloud CoE
- Action: Apply autoshutdown 19:00 UTC

### Finding 42: Missing budget
- Resource group: `rg-network-hub`
- Estimated monthly waste: **$390**
- Owner: Cloud CoE
- Action: Add cost-center tag

### Finding 43: Missing budget
- Resource group: `rg-ml-train`
- Estimated monthly waste: **$126**
- Owner: ML team
- Action: Add cost-center tag

### Finding 44: Unattached disks
- Resource group: `rg-aks-prod`
- Estimated monthly waste: **$62**
- Owner: Data team
- Action: Delete after 7d notice

### Finding 45: Unattached disks
- Resource group: `rg-mgmt`
- Estimated monthly waste: **$878**
- Owner: Data team
- Action: Right-size next maintenance window

### Finding 46: Unattached disks
- Resource group: `rg-aks-prod`
- Estimated monthly waste: **$370**
- Owner: Cloud CoE
- Action: Delete after 7d notice

### Finding 47: Premium disk on test workload
- Resource group: `rg-network-hub`
- Estimated monthly waste: **$445**
- Owner: Data team
- Action: Add cost-center tag

### Finding 48: Untagged storage
- Resource group: `rg-ml-train`
- Estimated monthly waste: **$84**
- Owner: Platform team
- Action: Apply autoshutdown 19:00 UTC

### Finding 49: Idle VM cluster
- Resource group: `rg-data-eus2`
- Estimated monthly waste: **$628**
- Owner: Cloud CoE
- Action: Apply autoshutdown 19:00 UTC

### Finding 50: Oversized SQL DB
- Resource group: `rg-aks-prod`
- Estimated monthly waste: **$579**
- Owner: ML team
- Action: Add cost-center tag

### Finding 51: Missing budget
- Resource group: `rg-data-eus2`
- Estimated monthly waste: **$523**
- Owner: Platform team
- Action: Delete after 7d notice

### Finding 52: Oversized SQL DB
- Resource group: `rg-ml-train`
- Estimated monthly waste: **$408**
- Owner: Data team
- Action: Add cost-center tag

### Finding 53: Oversized SQL DB
- Resource group: `rg-network-hub`
- Estimated monthly waste: **$875**
- Owner: Cloud CoE
- Action: Delete after 7d notice

### Finding 54: Missing budget
- Resource group: `rg-sql-prod`
- Estimated monthly waste: **$764**
- Owner: Data team
- Action: Right-size next maintenance window

### Finding 55: Premium disk on test workload
- Resource group: `rg-network-hub`
- Estimated monthly waste: **$691**
- Owner: Data team
- Action: Delete after 7d notice

### Finding 56: Idle VM cluster
- Resource group: `rg-aks-prod`
- Estimated monthly waste: **$300**
- Owner: ML team
- Action: Move to Standard SSD

### Finding 57: Premium disk on test workload
- Resource group: `rg-mgmt`
- Estimated monthly waste: **$272**
- Owner: ML team
- Action: Apply autoshutdown 19:00 UTC

### Finding 58: Unattached disks
- Resource group: `rg-data-eus2`
- Estimated monthly waste: **$916**
- Owner: ML team
- Action: Move to Standard SSD

### Finding 59: Idle VM cluster
- Resource group: `rg-aks-prod`
- Estimated monthly waste: **$725**
- Owner: Platform team
- Action: Delete after 7d notice

### Finding 60: Missing budget
- Resource group: `rg-platform-weu`
- Estimated monthly waste: **$508**
- Owner: Platform team
- Action: Right-size next maintenance window

### Finding 61: Oversized SQL DB
- Resource group: `rg-sql-prod`
- Estimated monthly waste: **$346**
- Owner: Platform team
- Action: Delete after 7d notice

### Finding 62: Idle VM cluster
- Resource group: `rg-platform-weu`
- Estimated monthly waste: **$199**
- Owner: Data team
- Action: Right-size next maintenance window

### Finding 63: Untagged storage
- Resource group: `rg-data-eus2`
- Estimated monthly waste: **$595**
- Owner: ML team
- Action: Right-size next maintenance window

### Finding 64: Untagged storage
- Resource group: `rg-network-hub`
- Estimated monthly waste: **$861**
- Owner: ML team
- Action: Add cost-center tag

### Finding 65: Idle VM cluster
- Resource group: `rg-data-eus2`
- Estimated monthly waste: **$794**
- Owner: Cloud CoE
- Action: Delete after 7d notice

### Finding 66: Unattached disks
- Resource group: `rg-network-hub`
- Estimated monthly waste: **$427**
- Owner: ML team
- Action: Apply autoshutdown 19:00 UTC

### Finding 67: Oversized SQL DB
- Resource group: `rg-mgmt`
- Estimated monthly waste: **$579**
- Owner: ML team
- Action: Add cost-center tag

### Finding 68: Unattached disks
- Resource group: `rg-aks-prod`
- Estimated monthly waste: **$415**
- Owner: Cloud CoE
- Action: Add cost-center tag

### Finding 69: Missing budget
- Resource group: `rg-platform-weu`
- Estimated monthly waste: **$375**
- Owner: Platform team
- Action: Add cost-center tag

### Finding 70: Idle VM cluster
- Resource group: `rg-platform-weu`
- Estimated monthly waste: **$793**
- Owner: Data team
- Action: Add cost-center tag

### Finding 71: Unattached disks
- Resource group: `rg-network-hub`
- Estimated monthly waste: **$932**
- Owner: ML team
- Action: Right-size next maintenance window

### Finding 72: Oversized SQL DB
- Resource group: `rg-platform-weu`
- Estimated monthly waste: **$487**
- Owner: Data team
- Action: Delete after 7d notice

### Finding 73: Idle VM cluster
- Resource group: `rg-network-hub`
- Estimated monthly waste: **$720**
- Owner: ML team
- Action: Delete after 7d notice

### Finding 74: Idle VM cluster
- Resource group: `rg-network-hub`
- Estimated monthly waste: **$641**
- Owner: Data team
- Action: Add cost-center tag

### Finding 75: Premium disk on test workload
- Resource group: `rg-sql-prod`
- Estimated monthly waste: **$638**
- Owner: Cloud CoE
- Action: Add cost-center tag

### Finding 76: Oversized SQL DB
- Resource group: `rg-platform-weu`
- Estimated monthly waste: **$763**
- Owner: ML team
- Action: Move to Standard SSD

### Finding 77: Unattached disks
- Resource group: `rg-ml-train`
- Estimated monthly waste: **$967**
- Owner: Platform team
- Action: Right-size next maintenance window

### Finding 78: Untagged storage
- Resource group: `rg-data-eus2`
- Estimated monthly waste: **$794**
- Owner: Cloud CoE
- Action: Add cost-center tag

### Finding 79: Premium disk on test workload
- Resource group: `rg-platform-weu`
- Estimated monthly waste: **$271**
- Owner: ML team
- Action: Right-size next maintenance window

### Finding 80: Untagged storage
- Resource group: `rg-ml-train`
- Estimated monthly waste: **$574**
- Owner: Platform team
- Action: Add cost-center tag

### Finding 81: Unattached disks
- Resource group: `rg-network-hub`
- Estimated monthly waste: **$258**
- Owner: Cloud CoE
- Action: Delete after 7d notice

### Finding 82: Premium disk on test workload
- Resource group: `rg-mgmt`
- Estimated monthly waste: **$558**
- Owner: Cloud CoE
- Action: Apply autoshutdown 19:00 UTC

### Finding 83: Premium disk on test workload
- Resource group: `rg-data-eus2`
- Estimated monthly waste: **$905**
- Owner: Data team
- Action: Add cost-center tag

### Finding 84: Oversized SQL DB
- Resource group: `rg-network-hub`
- Estimated monthly waste: **$218**
- Owner: ML team
- Action: Move to Standard SSD

### Finding 85: Idle VM cluster
- Resource group: `rg-mgmt`
- Estimated monthly waste: **$347**
- Owner: Data team
- Action: Right-size next maintenance window

### Finding 86: Unattached disks
- Resource group: `rg-platform-weu`
- Estimated monthly waste: **$671**
- Owner: Data team
- Action: Right-size next maintenance window

### Finding 87: Unattached disks
- Resource group: `rg-sql-prod`
- Estimated monthly waste: **$847**
- Owner: Cloud CoE
- Action: Right-size next maintenance window

### Finding 88: Oversized SQL DB
- Resource group: `rg-aks-prod`
- Estimated monthly waste: **$341**
- Owner: Cloud CoE
- Action: Apply autoshutdown 19:00 UTC

### Finding 89: Unattached disks
- Resource group: `rg-network-hub`
- Estimated monthly waste: **$909**
- Owner: Cloud CoE
- Action: Add cost-center tag

### Finding 90: Oversized SQL DB
- Resource group: `rg-platform-weu`
- Estimated monthly waste: **$665**
- Owner: Cloud CoE
- Action: Delete after 7d notice

### Finding 91: Untagged storage
- Resource group: `rg-data-eus2`
- Estimated monthly waste: **$48**
- Owner: Platform team
- Action: Add cost-center tag

### Finding 92: Missing budget
- Resource group: `rg-ml-train`
- Estimated monthly waste: **$257**
- Owner: Data team
- Action: Add cost-center tag

### Finding 93: Untagged storage
- Resource group: `rg-aks-prod`
- Estimated monthly waste: **$509**
- Owner: Cloud CoE
- Action: Right-size next maintenance window

### Finding 94: Untagged storage
- Resource group: `rg-sql-prod`
- Estimated monthly waste: **$678**
- Owner: ML team
- Action: Apply autoshutdown 19:00 UTC

### Finding 95: Missing budget
- Resource group: `rg-data-eus2`
- Estimated monthly waste: **$463**
- Owner: Cloud CoE
- Action: Move to Standard SSD

### Finding 96: Unattached disks
- Resource group: `rg-ml-train`
- Estimated monthly waste: **$705**
- Owner: Data team
- Action: Add cost-center tag

### Finding 97: Oversized SQL DB
- Resource group: `rg-data-eus2`
- Estimated monthly waste: **$589**
- Owner: ML team
- Action: Move to Standard SSD

### Finding 98: Missing budget
- Resource group: `rg-mgmt`
- Estimated monthly waste: **$924**
- Owner: ML team
- Action: Add cost-center tag

### Finding 99: Missing budget
- Resource group: `rg-ml-train`
- Estimated monthly waste: **$892**
- Owner: Platform team
- Action: Add cost-center tag

### Finding 100: Premium disk on test workload
- Resource group: `rg-aks-prod`
- Estimated monthly waste: **$262**
- Owner: ML team
- Action: Apply autoshutdown 19:00 UTC

### Finding 101: Premium disk on test workload
- Resource group: `rg-data-eus2`
- Estimated monthly waste: **$71**
- Owner: Cloud CoE
- Action: Delete after 7d notice

### Finding 102: Unattached disks
- Resource group: `rg-network-hub`
- Estimated monthly waste: **$499**
- Owner: Platform team
- Action: Add cost-center tag

### Finding 103: Missing budget
- Resource group: `rg-ml-train`
- Estimated monthly waste: **$601**
- Owner: Data team
- Action: Delete after 7d notice

### Finding 104: Idle VM cluster
- Resource group: `rg-mgmt`
- Estimated monthly waste: **$811**
- Owner: Platform team
- Action: Right-size next maintenance window

### Finding 105: Idle VM cluster
- Resource group: `rg-platform-weu`
- Estimated monthly waste: **$223**
- Owner: Data team
- Action: Right-size next maintenance window

### Finding 106: Unattached disks
- Resource group: `rg-aks-prod`
- Estimated monthly waste: **$431**
- Owner: Cloud CoE
- Action: Delete after 7d notice

### Finding 107: Unattached disks
- Resource group: `rg-ml-train`
- Estimated monthly waste: **$797**
- Owner: Data team
- Action: Apply autoshutdown 19:00 UTC

### Finding 108: Unattached disks
- Resource group: `rg-aks-prod`
- Estimated monthly waste: **$191**
- Owner: ML team
- Action: Add cost-center tag

### Finding 109: Oversized SQL DB
- Resource group: `rg-platform-weu`
- Estimated monthly waste: **$350**
- Owner: ML team
- Action: Apply autoshutdown 19:00 UTC

### Finding 110: Untagged storage
- Resource group: `rg-platform-weu`
- Estimated monthly waste: **$552**
- Owner: ML team
- Action: Delete after 7d notice

### Finding 111: Premium disk on test workload
- Resource group: `rg-ml-train`
- Estimated monthly waste: **$414**
- Owner: Cloud CoE
- Action: Move to Standard SSD

### Finding 112: Oversized SQL DB
- Resource group: `rg-mgmt`
- Estimated monthly waste: **$462**
- Owner: Data team
- Action: Delete after 7d notice

### Finding 113: Premium disk on test workload
- Resource group: `rg-network-hub`
- Estimated monthly waste: **$754**
- Owner: ML team
- Action: Delete after 7d notice

### Finding 114: Unattached disks
- Resource group: `rg-sql-prod`
- Estimated monthly waste: **$565**
- Owner: Cloud CoE
- Action: Delete after 7d notice

### Finding 115: Idle VM cluster
- Resource group: `rg-sql-prod`
- Estimated monthly waste: **$820**
- Owner: ML team
- Action: Apply autoshutdown 19:00 UTC

### Finding 116: Premium disk on test workload
- Resource group: `rg-sql-prod`
- Estimated monthly waste: **$934**
- Owner: Platform team
- Action: Add cost-center tag

### Finding 117: Missing budget
- Resource group: `rg-platform-weu`
- Estimated monthly waste: **$198**
- Owner: ML team
- Action: Apply autoshutdown 19:00 UTC

### Finding 118: Unattached disks
- Resource group: `rg-platform-weu`
- Estimated monthly waste: **$572**
- Owner: ML team
- Action: Move to Standard SSD

### Finding 119: Premium disk on test workload
- Resource group: `rg-ml-train`
- Estimated monthly waste: **$894**
- Owner: Cloud CoE
- Action: Right-size next maintenance window

### Finding 120: Unattached disks
- Resource group: `rg-data-eus2`
- Estimated monthly waste: **$564**
- Owner: Platform team
- Action: Apply autoshutdown 19:00 UTC

## Next Steps
1. Review with finance week of May 10
2. Publish chargeback dashboard
3. Roll out Azure Policy for required tags
