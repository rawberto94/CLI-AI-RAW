/**
 * Seed Script: Indirect Procurement Taxonomy (Generic)
 * 
 * This script populates the taxonomy management system with a comprehensive
 * indirect procurement category hierarchy suitable for most organizations.
 * 
 * Usage: npx tsx scripts/seed-indirect-procurement-taxonomy.ts
 */

interface TaxonomyCategory {
  name: string;
  description: string;
  keywords: string[];
  color: string;
  icon: string;
  children?: TaxonomyCategory[];
}

// Comprehensive Indirect Procurement Taxonomy
const INDIRECT_PROCUREMENT_TAXONOMY: TaxonomyCategory[] = [
  {
    name: "IT & Technology",
    description: "Information technology hardware, software, and services",
    keywords: ["technology", "IT", "software", "hardware", "computer", "network", "cloud", "SaaS", "data center"],
    color: "#3B82F6",
    icon: "laptop",
    children: [
      {
        name: "Software & Licensing",
        description: "Enterprise software licenses and subscriptions",
        keywords: ["software", "license", "SaaS", "subscription", "application", "ERP", "CRM", "Microsoft", "Oracle", "SAP"],
        color: "#6366F1",
        icon: "code",
        children: [
          { name: "Enterprise Applications", description: "ERP, CRM, and core business systems", keywords: ["ERP", "CRM", "SAP", "Oracle", "Salesforce", "enterprise"], color: "#6366F1", icon: "building" },
          { name: "Productivity Software", description: "Office suites and collaboration tools", keywords: ["Office 365", "Google Workspace", "Microsoft", "productivity", "email"], color: "#6366F1", icon: "file-text" },
          { name: "Security Software", description: "Cybersecurity and antivirus solutions", keywords: ["antivirus", "firewall", "security", "endpoint", "SIEM", "identity"], color: "#6366F1", icon: "shield" },
          { name: "Development Tools", description: "IDE, DevOps, and development platforms", keywords: ["IDE", "DevOps", "GitHub", "Azure DevOps", "Jenkins", "development"], color: "#6366F1", icon: "terminal" },
        ],
      },
      {
        name: "Hardware & Equipment",
        description: "Computer hardware and IT equipment",
        keywords: ["hardware", "computer", "server", "laptop", "desktop", "printer", "equipment"],
        color: "#0EA5E9",
        icon: "monitor",
        children: [
          { name: "End User Devices", description: "Laptops, desktops, and mobile devices", keywords: ["laptop", "desktop", "workstation", "tablet", "mobile", "Dell", "HP", "Lenovo"], color: "#0EA5E9", icon: "laptop" },
          { name: "Servers & Storage", description: "Data center equipment and storage", keywords: ["server", "storage", "NAS", "SAN", "Dell EMC", "NetApp", "data center"], color: "#0EA5E9", icon: "server" },
          { name: "Network Equipment", description: "Routers, switches, and networking gear", keywords: ["router", "switch", "firewall", "Cisco", "Juniper", "network"], color: "#0EA5E9", icon: "network" },
          { name: "Peripherals", description: "Monitors, printers, and accessories", keywords: ["monitor", "printer", "keyboard", "mouse", "peripheral", "accessory"], color: "#0EA5E9", icon: "printer" },
        ],
      },
      {
        name: "Cloud Services",
        description: "Cloud computing and hosting services",
        keywords: ["cloud", "AWS", "Azure", "GCP", "hosting", "IaaS", "PaaS", "infrastructure"],
        color: "#14B8A6",
        icon: "cloud",
        children: [
          { name: "Infrastructure (IaaS)", description: "Cloud infrastructure and compute", keywords: ["IaaS", "compute", "virtual machine", "EC2", "Azure VM", "infrastructure"], color: "#14B8A6", icon: "server" },
          { name: "Platform (PaaS)", description: "Platform services and databases", keywords: ["PaaS", "database", "RDS", "Azure SQL", "Kubernetes", "container"], color: "#14B8A6", icon: "layers" },
          { name: "Software (SaaS)", description: "Cloud-based software applications", keywords: ["SaaS", "software", "application", "Salesforce", "ServiceNow", "Workday"], color: "#14B8A6", icon: "globe" },
        ],
      },
      {
        name: "IT Services",
        description: "Managed IT services and consulting",
        keywords: ["managed services", "IT support", "consulting", "outsourcing", "helpdesk"],
        color: "#8B5CF6",
        icon: "headset",
        children: [
          { name: "Managed Services", description: "Outsourced IT management", keywords: ["managed", "MSP", "outsourced", "monitoring", "support"], color: "#8B5CF6", icon: "settings" },
          { name: "IT Consulting", description: "Technology advisory and consulting", keywords: ["consulting", "advisory", "strategy", "architecture", "implementation"], color: "#8B5CF6", icon: "user-check" },
          { name: "Development Services", description: "Custom software development", keywords: ["development", "custom", "programming", "integration", "API"], color: "#8B5CF6", icon: "code-2" },
        ],
      },
      {
        name: "Telecommunications",
        description: "Voice, data, and network connectivity",
        keywords: ["telecom", "phone", "internet", "WAN", "connectivity", "VoIP", "carrier"],
        color: "#F59E0B",
        icon: "phone",
        children: [
          { name: "Voice Services", description: "Phone systems and VoIP", keywords: ["phone", "VoIP", "PBX", "unified communications", "voice"], color: "#F59E0B", icon: "phone-call" },
          { name: "Data & Internet", description: "Internet and WAN connectivity", keywords: ["internet", "broadband", "WAN", "MPLS", "fiber", "connectivity"], color: "#F59E0B", icon: "wifi" },
          { name: "Mobile Services", description: "Wireless and mobile plans", keywords: ["mobile", "wireless", "cellular", "Verizon", "AT&T", "T-Mobile"], color: "#F59E0B", icon: "smartphone" },
        ],
      },
    ],
  },
  {
    name: "Facilities & Real Estate",
    description: "Building management, maintenance, and real estate services",
    keywords: ["facilities", "building", "maintenance", "real estate", "property", "office", "HVAC", "janitorial"],
    color: "#10B981",
    icon: "building-2",
    children: [
      {
        name: "Building Maintenance",
        description: "Facility maintenance and repairs",
        keywords: ["maintenance", "repair", "HVAC", "plumbing", "electrical", "building"],
        color: "#059669",
        icon: "wrench",
        children: [
          { name: "HVAC Services", description: "Heating, ventilation, and air conditioning", keywords: ["HVAC", "heating", "cooling", "air conditioning", "ventilation"], color: "#059669", icon: "thermometer" },
          { name: "Electrical Services", description: "Electrical maintenance and repairs", keywords: ["electrical", "wiring", "lighting", "power", "generator"], color: "#059669", icon: "zap" },
          { name: "Plumbing Services", description: "Plumbing and water systems", keywords: ["plumbing", "water", "pipes", "drainage", "fixtures"], color: "#059669", icon: "droplet" },
          { name: "General Maintenance", description: "General repairs and upkeep", keywords: ["repair", "handyman", "maintenance", "upkeep", "general"], color: "#059669", icon: "tool" },
        ],
      },
      {
        name: "Cleaning & Janitorial",
        description: "Cleaning and sanitation services",
        keywords: ["cleaning", "janitorial", "sanitation", "custodial", "housekeeping"],
        color: "#34D399",
        icon: "sparkles",
        children: [
          { name: "Office Cleaning", description: "Regular office cleaning services", keywords: ["office cleaning", "daily cleaning", "janitorial", "custodial"], color: "#34D399", icon: "sparkles" },
          { name: "Deep Cleaning", description: "Specialized deep cleaning services", keywords: ["deep cleaning", "carpet", "floor", "window", "specialized"], color: "#34D399", icon: "spray-can" },
          { name: "Waste Management", description: "Trash and recycling services", keywords: ["waste", "trash", "recycling", "disposal", "garbage"], color: "#34D399", icon: "trash-2" },
        ],
      },
      {
        name: "Security Services",
        description: "Physical security and access control",
        keywords: ["security", "guard", "surveillance", "access control", "alarm"],
        color: "#F97316",
        icon: "shield-check",
        children: [
          { name: "Guard Services", description: "On-site security personnel", keywords: ["guard", "security officer", "patrol", "personnel"], color: "#F97316", icon: "user-shield" },
          { name: "Access Control", description: "Badge systems and entry management", keywords: ["access control", "badge", "entry", "biometric", "keycard"], color: "#F97316", icon: "key" },
          { name: "Surveillance", description: "CCTV and monitoring systems", keywords: ["CCTV", "camera", "surveillance", "monitoring", "video"], color: "#F97316", icon: "video" },
        ],
      },
      {
        name: "Real Estate Services",
        description: "Property leasing and management",
        keywords: ["lease", "property", "real estate", "rent", "office space"],
        color: "#84CC16",
        icon: "home",
        children: [
          { name: "Office Leasing", description: "Office space rental agreements", keywords: ["lease", "office", "rent", "tenant", "landlord"], color: "#84CC16", icon: "building" },
          { name: "Property Management", description: "Property management services", keywords: ["property management", "facility management", "building management"], color: "#84CC16", icon: "key-round" },
          { name: "Relocation Services", description: "Office moves and relocations", keywords: ["relocation", "move", "moving", "office move", "transition"], color: "#84CC16", icon: "truck" },
        ],
      },
      {
        name: "Utilities",
        description: "Electric, gas, water, and utility services",
        keywords: ["utility", "electric", "gas", "water", "power", "energy"],
        color: "#EAB308",
        icon: "lightbulb",
        children: [
          { name: "Electricity", description: "Electric power services", keywords: ["electricity", "power", "electric", "energy", "kilowatt"], color: "#EAB308", icon: "zap" },
          { name: "Natural Gas", description: "Natural gas services", keywords: ["gas", "natural gas", "heating fuel", "propane"], color: "#EAB308", icon: "flame" },
          { name: "Water & Sewer", description: "Water and wastewater services", keywords: ["water", "sewer", "wastewater", "municipal"], color: "#EAB308", icon: "droplets" },
        ],
      },
    ],
  },
  {
    name: "Professional Services",
    description: "Consulting, legal, and specialized professional services",
    keywords: ["professional", "consulting", "legal", "accounting", "advisory", "expert"],
    color: "#8B5CF6",
    icon: "briefcase",
    children: [
      {
        name: "Legal Services",
        description: "Legal counsel and law firm services",
        keywords: ["legal", "law", "attorney", "lawyer", "counsel", "litigation"],
        color: "#7C3AED",
        icon: "scale",
        children: [
          { name: "Corporate Legal", description: "Corporate law and governance", keywords: ["corporate", "governance", "M&A", "securities", "compliance"], color: "#7C3AED", icon: "building-2" },
          { name: "Employment Law", description: "Employment and labor law", keywords: ["employment", "labor", "HR", "discrimination", "termination"], color: "#7C3AED", icon: "users" },
          { name: "Intellectual Property", description: "Patents, trademarks, and IP", keywords: ["IP", "patent", "trademark", "copyright", "intellectual property"], color: "#7C3AED", icon: "lightbulb" },
          { name: "Contract Law", description: "Contract review and negotiation", keywords: ["contract", "agreement", "negotiation", "review", "drafting"], color: "#7C3AED", icon: "file-signature" },
        ],
      },
      {
        name: "Accounting & Finance",
        description: "Accounting, audit, and financial services",
        keywords: ["accounting", "audit", "tax", "finance", "CPA", "bookkeeping"],
        color: "#059669",
        icon: "calculator",
        children: [
          { name: "Audit Services", description: "Financial audits and assurance", keywords: ["audit", "assurance", "financial statement", "internal audit"], color: "#059669", icon: "search" },
          { name: "Tax Services", description: "Tax preparation and planning", keywords: ["tax", "IRS", "compliance", "preparation", "planning"], color: "#059669", icon: "receipt" },
          { name: "Advisory Services", description: "Financial advisory and consulting", keywords: ["advisory", "consulting", "valuation", "due diligence", "transaction"], color: "#059669", icon: "trending-up" },
        ],
      },
      {
        name: "Management Consulting",
        description: "Strategy and management consulting",
        keywords: ["consulting", "strategy", "management", "McKinsey", "BCG", "Bain", "advisory"],
        color: "#3B82F6",
        icon: "lightbulb",
        children: [
          { name: "Strategy Consulting", description: "Business strategy and planning", keywords: ["strategy", "planning", "growth", "market entry", "transformation"], color: "#3B82F6", icon: "target" },
          { name: "Operations Consulting", description: "Operations improvement", keywords: ["operations", "process", "efficiency", "lean", "optimization"], color: "#3B82F6", icon: "settings" },
          { name: "Change Management", description: "Organizational change consulting", keywords: ["change", "transformation", "culture", "adoption", "training"], color: "#3B82F6", icon: "refresh-cw" },
        ],
      },
      {
        name: "Engineering & Technical",
        description: "Engineering and technical consulting",
        keywords: ["engineering", "technical", "architecture", "design", "structural"],
        color: "#F59E0B",
        icon: "compass",
        children: [
          { name: "Civil Engineering", description: "Civil and structural engineering", keywords: ["civil", "structural", "construction", "infrastructure", "bridge"], color: "#F59E0B", icon: "hard-hat" },
          { name: "Environmental", description: "Environmental consulting", keywords: ["environmental", "sustainability", "ESG", "remediation", "compliance"], color: "#F59E0B", icon: "leaf" },
          { name: "Project Management", description: "Project and program management", keywords: ["project management", "PMO", "program", "implementation"], color: "#F59E0B", icon: "gantt-chart" },
        ],
      },
    ],
  },
  {
    name: "Human Resources",
    description: "HR services, staffing, and employee benefits",
    keywords: ["HR", "human resources", "staffing", "recruiting", "benefits", "payroll", "training"],
    color: "#EC4899",
    icon: "users",
    children: [
      {
        name: "Staffing & Recruiting",
        description: "Temporary staffing and recruitment",
        keywords: ["staffing", "recruiting", "temp", "contingent", "headhunter", "talent"],
        color: "#DB2777",
        icon: "user-plus",
        children: [
          { name: "Contingent Staffing", description: "Temporary and contract workers", keywords: ["temp", "contingent", "contractor", "temporary", "staff augmentation"], color: "#DB2777", icon: "clock" },
          { name: "Executive Search", description: "Executive recruiting services", keywords: ["executive", "headhunter", "search", "C-suite", "leadership"], color: "#DB2777", icon: "search" },
          { name: "RPO Services", description: "Recruitment process outsourcing", keywords: ["RPO", "recruiting", "outsourcing", "talent acquisition"], color: "#DB2777", icon: "briefcase" },
        ],
      },
      {
        name: "Benefits & Insurance",
        description: "Employee benefits and insurance programs",
        keywords: ["benefits", "insurance", "health", "401k", "retirement", "wellness"],
        color: "#F472B6",
        icon: "heart",
        children: [
          { name: "Health Insurance", description: "Medical, dental, and vision plans", keywords: ["health", "medical", "dental", "vision", "insurance", "coverage"], color: "#F472B6", icon: "activity" },
          { name: "Retirement Plans", description: "401k and pension administration", keywords: ["401k", "retirement", "pension", "investment", "savings"], color: "#F472B6", icon: "piggy-bank" },
          { name: "Wellness Programs", description: "Employee wellness services", keywords: ["wellness", "EAP", "mental health", "fitness", "wellbeing"], color: "#F472B6", icon: "smile" },
        ],
      },
      {
        name: "Training & Development",
        description: "Employee training and learning programs",
        keywords: ["training", "learning", "development", "e-learning", "LMS", "education"],
        color: "#A855F7",
        icon: "book-open",
        children: [
          { name: "E-Learning Platforms", description: "Online learning systems", keywords: ["e-learning", "LMS", "online", "Coursera", "LinkedIn Learning"], color: "#A855F7", icon: "monitor-play" },
          { name: "Leadership Training", description: "Leadership development programs", keywords: ["leadership", "management", "executive", "coaching"], color: "#A855F7", icon: "award" },
          { name: "Technical Training", description: "Technical and skills training", keywords: ["technical", "certification", "skills", "professional development"], color: "#A855F7", icon: "tool" },
        ],
      },
      {
        name: "Payroll Services",
        description: "Payroll processing and administration",
        keywords: ["payroll", "ADP", "Paychex", "processing", "timekeeping"],
        color: "#14B8A6",
        icon: "dollar-sign",
        children: [
          { name: "Payroll Processing", description: "Payroll calculation and disbursement", keywords: ["payroll", "processing", "direct deposit", "paystub"], color: "#14B8A6", icon: "credit-card" },
          { name: "Time & Attendance", description: "Time tracking systems", keywords: ["time", "attendance", "timekeeping", "clock", "scheduling"], color: "#14B8A6", icon: "clock" },
        ],
      },
    ],
  },
  {
    name: "Marketing & Advertising",
    description: "Marketing services, advertising, and creative agencies",
    keywords: ["marketing", "advertising", "creative", "agency", "branding", "media", "digital"],
    color: "#F97316",
    icon: "megaphone",
    children: [
      {
        name: "Creative Services",
        description: "Creative agencies and design services",
        keywords: ["creative", "design", "branding", "agency", "graphic", "video"],
        color: "#EA580C",
        icon: "palette",
        children: [
          { name: "Branding & Design", description: "Brand identity and graphic design", keywords: ["branding", "logo", "identity", "graphic design", "visual"], color: "#EA580C", icon: "pen-tool" },
          { name: "Video Production", description: "Video and multimedia production", keywords: ["video", "production", "multimedia", "animation", "motion"], color: "#EA580C", icon: "video" },
          { name: "Content Creation", description: "Content and copywriting services", keywords: ["content", "copywriting", "writing", "editorial", "blog"], color: "#EA580C", icon: "edit" },
        ],
      },
      {
        name: "Digital Marketing",
        description: "Digital and online marketing services",
        keywords: ["digital", "online", "SEO", "SEM", "social media", "PPC"],
        color: "#0EA5E9",
        icon: "globe",
        children: [
          { name: "SEO & SEM", description: "Search engine optimization and marketing", keywords: ["SEO", "SEM", "search", "Google Ads", "PPC", "keywords"], color: "#0EA5E9", icon: "search" },
          { name: "Social Media", description: "Social media marketing", keywords: ["social media", "Facebook", "LinkedIn", "Instagram", "Twitter"], color: "#0EA5E9", icon: "share-2" },
          { name: "Email Marketing", description: "Email campaigns and automation", keywords: ["email", "newsletter", "Mailchimp", "automation", "campaign"], color: "#0EA5E9", icon: "mail" },
        ],
      },
      {
        name: "Advertising & Media",
        description: "Advertising placement and media buying",
        keywords: ["advertising", "media", "placement", "TV", "radio", "print", "outdoor"],
        color: "#8B5CF6",
        icon: "tv",
        children: [
          { name: "Media Buying", description: "Media planning and buying", keywords: ["media buying", "placement", "programmatic", "advertising"], color: "#8B5CF6", icon: "shopping-cart" },
          { name: "Print Advertising", description: "Print and publication ads", keywords: ["print", "magazine", "newspaper", "publication"], color: "#8B5CF6", icon: "newspaper" },
          { name: "Outdoor Advertising", description: "Billboard and outdoor media", keywords: ["outdoor", "billboard", "OOH", "signage"], color: "#8B5CF6", icon: "map-pin" },
        ],
      },
      {
        name: "Events & Trade Shows",
        description: "Event management and trade show services",
        keywords: ["events", "trade show", "conference", "exhibit", "sponsorship"],
        color: "#10B981",
        icon: "calendar",
        children: [
          { name: "Event Management", description: "Corporate event planning", keywords: ["event", "planning", "conference", "meeting", "corporate"], color: "#10B981", icon: "calendar-days" },
          { name: "Trade Shows", description: "Trade show and exhibit services", keywords: ["trade show", "exhibit", "booth", "convention"], color: "#10B981", icon: "store" },
          { name: "Promotional Items", description: "Branded merchandise and swag", keywords: ["promotional", "merchandise", "swag", "branded", "giveaway"], color: "#10B981", icon: "gift" },
        ],
      },
    ],
  },
  {
    name: "Travel & Expenses",
    description: "Business travel, lodging, and expense management",
    keywords: ["travel", "expense", "lodging", "airline", "hotel", "car rental", "fleet"],
    color: "#0EA5E9",
    icon: "plane",
    children: [
      {
        name: "Air Travel",
        description: "Airline and flight services",
        keywords: ["airline", "flight", "air travel", "booking", "travel management"],
        color: "#0284C7",
        icon: "plane",
        children: [
          { name: "Commercial Airlines", description: "Scheduled airline services", keywords: ["airline", "commercial", "flight", "booking", "ticket"], color: "#0284C7", icon: "plane-takeoff" },
          { name: "Charter & Private", description: "Private and charter aviation", keywords: ["charter", "private", "jet", "aircraft", "aviation"], color: "#0284C7", icon: "plane-landing" },
        ],
      },
      {
        name: "Lodging",
        description: "Hotel and accommodation services",
        keywords: ["hotel", "lodging", "accommodation", "Marriott", "Hilton", "corporate housing"],
        color: "#14B8A6",
        icon: "bed",
        children: [
          { name: "Hotels", description: "Hotel chains and accommodations", keywords: ["hotel", "Marriott", "Hilton", "Hyatt", "accommodation"], color: "#14B8A6", icon: "building" },
          { name: "Corporate Housing", description: "Extended stay and corporate apartments", keywords: ["corporate housing", "extended stay", "apartment", "relocation"], color: "#14B8A6", icon: "home" },
        ],
      },
      {
        name: "Ground Transportation",
        description: "Car rental and ground transport",
        keywords: ["car rental", "taxi", "Uber", "limo", "shuttle", "ground transport"],
        color: "#F59E0B",
        icon: "car",
        children: [
          { name: "Car Rental", description: "Rental car services", keywords: ["car rental", "Enterprise", "Hertz", "Avis", "vehicle"], color: "#F59E0B", icon: "car" },
          { name: "Rideshare & Taxi", description: "Taxi and rideshare services", keywords: ["taxi", "Uber", "Lyft", "rideshare", "car service"], color: "#F59E0B", icon: "map" },
          { name: "Fleet Management", description: "Company vehicle fleet", keywords: ["fleet", "vehicle", "company car", "leasing", "telematics"], color: "#F59E0B", icon: "truck" },
        ],
      },
      {
        name: "Travel Management",
        description: "Travel agencies and booking tools",
        keywords: ["travel management", "TMC", "booking", "Concur", "expense"],
        color: "#8B5CF6",
        icon: "briefcase",
        children: [
          { name: "Travel Agencies (TMC)", description: "Corporate travel management companies", keywords: ["TMC", "travel agency", "American Express", "BCD", "CWT"], color: "#8B5CF6", icon: "map-pin" },
          { name: "Expense Management", description: "Expense tracking and reimbursement", keywords: ["expense", "Concur", "reimbursement", "T&E", "receipts"], color: "#8B5CF6", icon: "receipt" },
        ],
      },
    ],
  },
  {
    name: "Office Supplies & Equipment",
    description: "Office supplies, furniture, and equipment",
    keywords: ["office supplies", "furniture", "equipment", "Staples", "supplies", "stationery"],
    color: "#6366F1",
    icon: "package",
    children: [
      {
        name: "Office Supplies",
        description: "General office supplies and consumables",
        keywords: ["supplies", "stationery", "paper", "Staples", "Office Depot"],
        color: "#4F46E5",
        icon: "paperclip",
        children: [
          { name: "General Supplies", description: "Pens, paper, and general supplies", keywords: ["paper", "pens", "folders", "supplies", "stationery"], color: "#4F46E5", icon: "edit-3" },
          { name: "Printing Supplies", description: "Toner, ink, and printing materials", keywords: ["toner", "ink", "cartridge", "printing", "paper"], color: "#4F46E5", icon: "printer" },
          { name: "Breakroom Supplies", description: "Kitchen and breakroom items", keywords: ["breakroom", "coffee", "kitchen", "snacks", "beverages"], color: "#4F46E5", icon: "coffee" },
        ],
      },
      {
        name: "Office Furniture",
        description: "Desks, chairs, and office furnishings",
        keywords: ["furniture", "desk", "chair", "ergonomic", "cubicle"],
        color: "#7C3AED",
        icon: "armchair",
        children: [
          { name: "Workstations", description: "Desks and workstation systems", keywords: ["desk", "workstation", "cubicle", "standing desk"], color: "#7C3AED", icon: "square" },
          { name: "Seating", description: "Chairs and seating solutions", keywords: ["chair", "seating", "ergonomic", "Herman Miller", "Steelcase"], color: "#7C3AED", icon: "armchair" },
          { name: "Storage & Filing", description: "Filing cabinets and storage", keywords: ["filing", "cabinet", "storage", "shelving", "locker"], color: "#7C3AED", icon: "archive" },
        ],
      },
      {
        name: "Office Equipment",
        description: "Copiers, fax, and office machines",
        keywords: ["copier", "fax", "scanner", "shredder", "equipment"],
        color: "#EC4899",
        icon: "printer",
        children: [
          { name: "Copiers & Printers", description: "Multifunction printers and copiers", keywords: ["copier", "printer", "MFP", "Xerox", "Canon"], color: "#EC4899", icon: "printer" },
          { name: "Shredders", description: "Document shredders and destruction", keywords: ["shredder", "document destruction", "security"], color: "#EC4899", icon: "scissors" },
          { name: "Mail & Shipping", description: "Postage and shipping equipment", keywords: ["postage", "mail", "shipping", "FedEx", "UPS", "courier"], color: "#EC4899", icon: "package" },
        ],
      },
    ],
  },
  {
    name: "Financial Services",
    description: "Banking, insurance, and financial services",
    keywords: ["banking", "insurance", "finance", "credit", "treasury", "payment"],
    color: "#059669",
    icon: "landmark",
    children: [
      {
        name: "Banking Services",
        description: "Corporate banking and treasury services",
        keywords: ["banking", "treasury", "corporate", "account", "wire transfer"],
        color: "#047857",
        icon: "building-columns",
        children: [
          { name: "Commercial Banking", description: "Business banking services", keywords: ["commercial", "business banking", "account", "deposit"], color: "#047857", icon: "landmark" },
          { name: "Treasury Services", description: "Cash management and treasury", keywords: ["treasury", "cash management", "liquidity", "wire"], color: "#047857", icon: "wallet" },
          { name: "Credit Facilities", description: "Lines of credit and loans", keywords: ["credit", "loan", "line of credit", "financing"], color: "#047857", icon: "credit-card" },
        ],
      },
      {
        name: "Insurance Services",
        description: "Commercial insurance coverage",
        keywords: ["insurance", "liability", "property", "D&O", "risk"],
        color: "#10B981",
        icon: "shield",
        children: [
          { name: "Property & Casualty", description: "Property and liability insurance", keywords: ["property", "casualty", "liability", "P&C"], color: "#10B981", icon: "home" },
          { name: "Professional Liability", description: "E&O and professional insurance", keywords: ["E&O", "professional", "malpractice", "errors"], color: "#10B981", icon: "briefcase" },
          { name: "Directors & Officers", description: "D&O and executive coverage", keywords: ["D&O", "directors", "officers", "executive"], color: "#10B981", icon: "users" },
        ],
      },
      {
        name: "Payment Services",
        description: "Payment processing and cards",
        keywords: ["payment", "credit card", "processing", "merchant", "P-card"],
        color: "#0EA5E9",
        icon: "credit-card",
        children: [
          { name: "Corporate Cards", description: "Corporate and P-card programs", keywords: ["corporate card", "P-card", "purchasing card", "Amex"], color: "#0EA5E9", icon: "credit-card" },
          { name: "Payment Processing", description: "Merchant and payment services", keywords: ["payment", "merchant", "processing", "ACH", "wire"], color: "#0EA5E9", icon: "banknote" },
        ],
      },
    ],
  },
  {
    name: "Logistics & Distribution",
    description: "Shipping, freight, and logistics services",
    keywords: ["logistics", "shipping", "freight", "distribution", "warehouse", "3PL"],
    color: "#F59E0B",
    icon: "truck",
    children: [
      {
        name: "Freight & Shipping",
        description: "Freight and package shipping",
        keywords: ["freight", "shipping", "carrier", "FedEx", "UPS", "LTL"],
        color: "#D97706",
        icon: "package",
        children: [
          { name: "Parcel Carriers", description: "Package and express shipping", keywords: ["parcel", "FedEx", "UPS", "DHL", "express"], color: "#D97706", icon: "box" },
          { name: "LTL & Trucking", description: "Less-than-truckload freight", keywords: ["LTL", "trucking", "freight", "carrier", "shipment"], color: "#D97706", icon: "truck" },
          { name: "Ocean & Air Freight", description: "International freight forwarding", keywords: ["ocean", "air freight", "international", "forwarding", "container"], color: "#D97706", icon: "ship" },
        ],
      },
      {
        name: "Warehousing",
        description: "Storage and distribution centers",
        keywords: ["warehouse", "storage", "distribution", "fulfillment", "3PL"],
        color: "#F59E0B",
        icon: "warehouse",
        children: [
          { name: "3PL Services", description: "Third-party logistics", keywords: ["3PL", "logistics", "fulfillment", "outsourced"], color: "#F59E0B", icon: "package-check" },
          { name: "Cold Storage", description: "Temperature-controlled storage", keywords: ["cold storage", "refrigerated", "frozen", "temperature"], color: "#F59E0B", icon: "thermometer-snowflake" },
        ],
      },
      {
        name: "Courier Services",
        description: "Local courier and same-day delivery",
        keywords: ["courier", "messenger", "same-day", "local delivery"],
        color: "#84CC16",
        icon: "bike",
        children: [
          { name: "Same-Day Delivery", description: "Urgent local delivery", keywords: ["same-day", "rush", "urgent", "express local"], color: "#84CC16", icon: "timer" },
          { name: "Document Courier", description: "Document and legal delivery", keywords: ["document", "legal", "courier", "messenger"], color: "#84CC16", icon: "file" },
        ],
      },
    ],
  },
  {
    name: "MRO & Industrial",
    description: "Maintenance, repair, and operations supplies",
    keywords: ["MRO", "industrial", "maintenance", "repair", "operations", "tools", "safety"],
    color: "#DC2626",
    icon: "hard-hat",
    children: [
      {
        name: "Industrial Supplies",
        description: "Industrial equipment and supplies",
        keywords: ["industrial", "supplies", "Grainger", "MSC", "Fastenal"],
        color: "#B91C1C",
        icon: "wrench",
        children: [
          { name: "Tools & Equipment", description: "Hand and power tools", keywords: ["tools", "power tools", "equipment", "hand tools"], color: "#B91C1C", icon: "hammer" },
          { name: "Fasteners & Hardware", description: "Nuts, bolts, and hardware", keywords: ["fasteners", "hardware", "nuts", "bolts", "screws"], color: "#B91C1C", icon: "puzzle" },
          { name: "Lubricants & Chemicals", description: "Industrial chemicals and lubricants", keywords: ["lubricant", "chemical", "oil", "grease", "solvent"], color: "#B91C1C", icon: "flask" },
        ],
      },
      {
        name: "Safety & PPE",
        description: "Safety equipment and personal protective equipment",
        keywords: ["safety", "PPE", "protective", "equipment", "OSHA"],
        color: "#F97316",
        icon: "shield-alert",
        children: [
          { name: "Personal Protective Equipment", description: "Safety gear and PPE", keywords: ["PPE", "gloves", "goggles", "helmet", "protective"], color: "#F97316", icon: "shield" },
          { name: "Safety Signage", description: "Safety signs and barriers", keywords: ["signage", "signs", "barriers", "cones", "tape"], color: "#F97316", icon: "alert-triangle" },
          { name: "First Aid", description: "First aid and emergency supplies", keywords: ["first aid", "emergency", "medical", "AED", "kit"], color: "#F97316", icon: "plus-circle" },
        ],
      },
      {
        name: "Electrical & Lighting",
        description: "Electrical supplies and lighting",
        keywords: ["electrical", "lighting", "wire", "conduit", "LED"],
        color: "#EAB308",
        icon: "lightbulb",
        children: [
          { name: "Electrical Components", description: "Wiring and electrical parts", keywords: ["wire", "conduit", "breaker", "electrical", "components"], color: "#EAB308", icon: "plug" },
          { name: "Lighting", description: "Commercial lighting products", keywords: ["lighting", "LED", "bulb", "fixture", "lamp"], color: "#EAB308", icon: "lamp" },
        ],
      },
    ],
  },
];

// API base URL
const API_BASE = process.env.API_URL || "http://localhost:3005/api";
const TENANT_ID = process.env.TENANT_ID || "demo";

async function createCategory(
  category: TaxonomyCategory,
  parentId?: string
): Promise<string | null> {
  try {
    const response = await fetch(`${API_BASE}/taxonomy`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-tenant-id": TENANT_ID,
      },
      body: JSON.stringify({
        name: category.name,
        description: category.description,
        parentId: parentId || undefined,
        keywords: category.keywords,
        color: category.color,
        icon: category.icon,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error(`❌ Failed to create "${category.name}":`, error.details || error.error);
      return null;
    }

    const result = await response.json();
    console.log(`✅ Created: ${category.name} (${result.data.id})`);
    return result.data.id;
  } catch (error) {
    console.error(`❌ Error creating "${category.name}":`, error);
    return null;
  }
}

async function seedTaxonomy(
  categories: TaxonomyCategory[],
  parentId?: string,
  level = 0
): Promise<number> {
  let count = 0;
  const indent = "  ".repeat(level);

  for (const category of categories) {
    console.log(`${indent}📁 ${category.name}...`);
    
    const id = await createCategory(category, parentId);
    if (id) {
      count++;
      
      // Recursively create children
      if (category.children && category.children.length > 0) {
        const childCount = await seedTaxonomy(category.children, id, level + 1);
        count += childCount;
      }
    }
  }

  return count;
}

async function main() {
  console.log("🌱 Seeding Indirect Procurement Taxonomy (Generic)");
  console.log("================================================");
  console.log(`📡 API: ${API_BASE}`);
  console.log(`🏢 Tenant: ${TENANT_ID}`);
  console.log("");

  const startTime = Date.now();
  const totalCreated = await seedTaxonomy(INDIRECT_PROCUREMENT_TAXONOMY);
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log("");
  console.log("================================================");
  console.log(`✅ Completed! Created ${totalCreated} categories in ${duration}s`);
  console.log("");
  console.log("Categories include:");
  INDIRECT_PROCUREMENT_TAXONOMY.forEach((cat) => {
    console.log(`  • ${cat.name}`);
  });
}

main().catch(console.error);
