# 根拠: FinalArch:MCP-002 / FinalArch:CON-004 / ADR-0023 / WBS P4-T03
package system.log

import rego.v1

# Decision logs retain receipt metadata while removing caller input before
# stdout/OTel collection.
mask contains "/input" if {
	true
}
