export const sampleBusinesses = [
  "Apex Automotive Components",
  "Northstar Steel Works",
  "Precision Motion Systems",
  "Evergreen Packaging",
  "Summit Industrial Pumps",
];

export interface SampleRisk {
  id: string;
  business: string;
  title: string;
  description: string;
  severity: "High" | "Medium" | "Low";
  status: "Open" | "Monitoring" | "Resolved";
  line: string;
  process: string;
  occurredAt: string;
  owner: string;
  impact: string;
  response: string;
}

export const sampleRisks: SampleRisk[] = [
  {
    id: "RSK-1042", business: sampleBusinesses[0], title: "Hydraulic press temperature above limit",
    description: "Press temperature reached 91°C during the morning production cycle.",
    severity: "High", status: "Open", line: "Press Line 2", process: "Hot forming · Press P-204",
    occurredAt: "2026-10-09T09:42:00", owner: "Ravi Kumar", impact: "Potential 3-hour production delay",
    response: "Inspect the cooling loop and verify the press sensor before the next batch.",
  },
  {
    id: "RSK-1043", business: sampleBusinesses[0], title: "Critical bearing delivery at risk",
    description: "Supplier confirmation is still pending for a component required next week.",
    severity: "Medium", status: "Monitoring", line: "Assembly Line 1", process: "Inbound materials · Receiving dock",
    occurredAt: "2026-10-09T08:15:00", owner: "Kumar Patel", impact: "Could affect 2 scheduled builds",
    response: "Confirm dispatch with the supplier and identify an approved alternate source.",
  },
  {
    id: "RSK-1044", business: sampleBusinesses[1], title: "Rolling mill vibration trending upward",
    description: "Vibration readings have exceeded the maintenance watch threshold in three checks.",
    severity: "High", status: "Open", line: "Rolling Mill Line 1", process: "Hot rolling · Mill Stand M-08",
    occurredAt: "2026-10-09T07:28:00", owner: "Meera Shah", impact: "Unplanned equipment stoppage risk",
    response: "Schedule an inspection of the drive bearings during the next planned pause.",
  },
  {
    id: "RSK-1045", business: sampleBusinesses[1], title: "Furnace refractory inspection overdue",
    description: "A routine lining inspection has not been recorded for the current shift.",
    severity: "Medium", status: "Monitoring", line: "Furnace Line 3", process: "Heat treatment · Furnace F-03",
    occurredAt: "2026-10-08T22:10:00", owner: "Daniel Lee", impact: "May delay the next heat cycle",
    response: "Complete the inspection checklist before loading the next production batch.",
  },
  {
    id: "RSK-1046", business: sampleBusinesses[2], title: "CNC cell tool wear beyond target",
    description: "Tool-life readings show faster-than-expected wear on the finishing operation.",
    severity: "Medium", status: "Open", line: "CNC Cell 4", process: "Precision machining · Lathe L-14",
    occurredAt: "2026-10-09T10:06:00", owner: "Anita Rao", impact: "Quality rework risk on 18 parts",
    response: "Replace the insert and inspect the last completed parts against tolerance.",
  },
  {
    id: "RSK-1047", business: sampleBusinesses[2], title: "Calibration certificate nearing expiry",
    description: "The coordinate measuring machine certificate expires before the next audit.",
    severity: "Low", status: "Monitoring", line: "Quality Lab", process: "Final inspection · CMM-02",
    occurredAt: "2026-10-08T15:35:00", owner: "James Wilson", impact: "Audit readiness may be affected",
    response: "Book the accredited calibration and attach the certificate to the quality record.",
  },
  {
    id: "RSK-1048", business: sampleBusinesses[3], title: "Cartoner label alignment drift",
    description: "Pack labels are drifting toward the edge of the carton on recent samples.",
    severity: "Medium", status: "Open", line: "Packaging Line 2", process: "Cartoning · Cartoner C-11",
    occurredAt: "2026-10-09T06:54:00", owner: "Priya Nair", impact: "Product presentation and scan failures",
    response: "Recalibrate the label guide and confirm a 10-pack sample before restart.",
  },
  {
    id: "RSK-1049", business: sampleBusinesses[3], title: "Compressed air pressure fluctuation",
    description: "Intermittent pressure dips were reported at the case sealer.",
    severity: "Low", status: "Resolved", line: "Packaging Line 1", process: "Case sealing · Sealer S-05",
    occurredAt: "2026-10-08T11:20:00", owner: "Oliver Chen", impact: "Short stoppages during changeover",
    response: "Filter was replaced and line pressure is stable after restart.",
  },
  {
    id: "RSK-1050", business: sampleBusinesses[4], title: "Pump test bench flow reading unstable",
    description: "Flow measurements vary between repeated runs on the same test setup.",
    severity: "High", status: "Open", line: "Test Bay 2", process: "Performance testing · Bench TB-02",
    occurredAt: "2026-10-09T09:17:00", owner: "Ravi Kumar", impact: "Shipment release may be delayed",
    response: "Check the flow meter calibration and repeat the test with a verified setup.",
  },
  {
    id: "RSK-1051", business: sampleBusinesses[4], title: "Seal kit stock below reorder point",
    description: "Available seal kits are below the minimum quantity for planned assembly.",
    severity: "Medium", status: "Monitoring", line: "Pump Assembly Line 1", process: "Kitting · Stores zone B",
    occurredAt: "2026-10-08T16:05:00", owner: "Meera Shah", impact: "May constrain 4 planned assemblies",
    response: "Expedite replenishment and reserve remaining kits for committed orders.",
  },
];

export interface SampleAction {
  id: string;
  title: string;
  milestone: string;
  owner: string;
  priority: "High" | "Medium" | "Low";
  dueDate: string;
  status: "Open" | "In Progress" | "Completed" | "Overdue";
  project: string;
  details: string;
}

export const sampleActions: SampleAction[] = [
  { id: "A-001", title: "Complete engineering approval for design", milestone: "Engineering Approval", owner: "Ravi", priority: "High", dueDate: "2026-10-10", status: "Open", project: "PRJ-001", details: "Review and sign off the latest equipment layout and design package." },
  { id: "A-002", title: "Expedite PO release with vendor", milestone: "PO Release", owner: "Kumar", priority: "High", dueDate: "2026-10-12", status: "In Progress", project: "PRJ-001", details: "Confirm purchase order release and obtain the supplier's acknowledged delivery date." },
  { id: "A-003", title: "Confirm material delivery schedule", milestone: "Material Delivery", owner: "Vendor A", priority: "Medium", dueDate: "2026-10-20", status: "Open", project: "PRJ-002", details: "Verify quantities, shipping dates, and receiving capacity for critical materials." },
  { id: "A-004", title: "Check site readiness for installation", milestone: "Installation", owner: "Site Team", priority: "Medium", dueDate: "2026-10-25", status: "Overdue", project: "PRJ-001", details: "Confirm utilities, access routes, and safety permits are ready for installation." },
  { id: "A-005", title: "Commissioning test setup", milestone: "Commissioning", owner: "Commissioning Team", priority: "Low", dueDate: "2026-10-30", status: "Open", project: "PRJ-002", details: "Prepare commissioning procedures, test instruments, and the site acceptance checklist." },
  { id: "A-006", title: "Close supplier quality documentation", milestone: "Vendor Manufacturing", owner: "Anita", priority: "Medium", dueDate: "2026-10-28", status: "Completed", project: "PRJ-001", details: "Collect material certificates and inspection records from the equipment supplier." },
  { id: "A-007", title: "Reserve factory acceptance test slot", milestone: "FAT", owner: "Daniel", priority: "High", dueDate: "2026-11-02", status: "In Progress", project: "PRJ-002", details: "Align the factory test schedule with vendor readiness and stakeholder availability." },
  { id: "A-008", title: "Publish updated installation risk assessment", milestone: "Site Readiness", owner: "Priya", priority: "Low", dueDate: "2026-11-04", status: "Open", project: "PRJ-001", details: "Share the reviewed installation risk assessment with site and engineering teams." },
];
