with open("E:/n8n/src/pages/Reports.jsx", "r", encoding="utf-8") as f:
    content = f.read()

monthshort_pos = content.find("const MONTH_SHORT")

new_header = (
    'import { useEffect, useState } from "react";\n'
    'import { useQuery } from "@tanstack/react-query";\n'
    'import { useNavigate } from "react-router-dom";\n'
    'import Sidebar from "../components/Sidebar";\n'
    'import Topbar from "../components/Topbar";\n'
    'import { api } from "../lib/api";\n'
    'import { moneyCompact as money, fmtDate } from "../lib/formatters";\n'
    'import DonutChart from "../components/DonutChart";\n'
    'import "./Sales.css";\n'
    'import "./SalesDashboard.css";\n'
    'import "./Reports.css";\n\n'
)

content = new_header + content[monthshort_pos:]
print("Replaced import block")

# Remove local DonutChart function (keep BarChart, it's Reports-specific)
donut_start = content.find("\nfunction DonutChart(")
loading_start = content.find("\nfunction Loading()")
if donut_start != -1 and loading_start != -1:
    content = content[:donut_start] + "\n" + content[loading_start:]
    print("Removed local DonutChart function")
else:
    print("WARNING: DonutChart boundaries not found", donut_start, loading_start)

with open("E:/n8n/src/pages/Reports.jsx", "w", encoding="utf-8") as f:
    f.write(content)

print("Done. File size:", len(content))
