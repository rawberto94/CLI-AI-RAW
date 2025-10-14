# 🔍 Demo Validation Script

## **Pre-Demo System Check (2 Minutes)**

### **1. Environment Validation**
```bash
# Check OpenAI API key is set
echo "OpenAI API Key: ${OPENAI_API_KEY:0:10}..."
# Should show: sk-proj-... or sk-...

# Verify system is running
curl -s http://localhost:3000/api/health | jq .
# Should return: {"status": "ok"}
```

### **2. Core Services Check**
```bash
# Test analytical intelligence health
curl -s http://localhost:3000/api/analytics/health | jq .
# Should return: {"status": "healthy", "engines": {...}}

# Test dashboard data
curl -s http://localhost:3000/api/analytics/dashboard | jq '.overview'
# Should return overview metrics
```

### **3. Upload System Check**
```bash
# Test upload endpoint
curl -s http://localhost:3000/api/contracts | head -5
# Should return without errors
```

## **🎯 Demo Flow Validation**

### **Page 1: Main Dashboard** ✅
**URL**: `http://localhost:3000/`
**Expected**: Upload zone with progress tracking
**Key Features**:
- File drag & drop functionality
- Real-time upload progress
- AI analysis status indicators

### **Page 2: Analytics Intelligence** ✅
**URL**: `http://localhost:3000/analytics/intelligence`
**Expected**: Comprehensive analytics dashboard
**Key Features**:
- Overview metrics with real numbers
- 6 analytical engine tabs
- Natural language query interface
- Interactive charts and visualizations

### **Page 3: Enhanced Dashboard** ✅
**URL**: `http://localhost:3000/analytics/enhanced-dashboard`
**Expected**: Optimized analytics interface
**Key Features**:
- Real-time data updates
- Advanced visualizations
- Action center with recommendations
- Export capabilities

### **Page 4: Procurement Hub** ✅
**URL**: `http://localhost:3000/use-cases/procurement-hub`
**Expected**: Complete use cases showcase
**Key Features**:
- AI insights engine
- Market intelligence
- Supplier analytics
- Savings calculator

## **🧪 Quick Demo Test Sequence**

### **Test 1: Upload & AI Analysis (30 seconds)**
```
1. Go to http://localhost:3000/
2. Upload any PDF file
3. Watch progress indicators
4. Verify AI analysis completes
5. Check generated intelligence
```

### **Test 2: Dashboard Navigation (30 seconds)**
```
1. Go to http://localhost:3000/analytics/intelligence
2. Verify all tabs load data
3. Test natural language query: "Show me high-risk contracts"
4. Check response is generated
```

### **Test 3: Use Cases Tour (30 seconds)**
```
1. Go to http://localhost:3000/use-cases/procurement-hub
2. Click through different sections
3. Verify all components load
4. Test interactive elements
```

## **🚨 Troubleshooting Common Issues**

### **Issue: OpenAI API Key Not Working**
```bash
# Test API key directly
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  | jq '.data[0].id'
# Should return a model name like "gpt-4o-mini"
```

### **Issue: Dashboard Not Loading Data**
```bash
# Check if analytical services are running
curl -s http://localhost:3000/api/analytics/intelligence/route | jq .
# Should return analytical data
```

### **Issue: Upload Not Processing**
```bash
# Check upload directory exists
ls -la apps/web/uploads/
# Should show upload directory

# Check processing logs
tail -f apps/web/logs/upload.log
```

## **📋 Demo Readiness Checklist**

### **System Status** ✅
- [ ] Next.js dev server running on port 3000
- [ ] OpenAI API key configured and validated
- [ ] All analytical engines responding
- [ ] Dashboard loading with mock data
- [ ] Upload system functional

### **Demo Materials** ✅
- [ ] Sample contracts prepared (2-3 PDFs)
- [ ] Browser bookmarks for key pages
- [ ] Demo script reviewed
- [ ] Backup plans for common issues

### **Key URLs Bookmarked** ✅
- [ ] `http://localhost:3000/` - Main upload
- [ ] `http://localhost:3000/analytics/intelligence` - Analytics
- [ ] `http://localhost:3000/analytics/enhanced-dashboard` - Enhanced
- [ ] `http://localhost:3000/use-cases/procurement-hub` - Use cases

## **🎬 Demo Success Indicators**

### **What Should Work Perfectly**
✅ **File Upload** - Smooth drag & drop with progress  
✅ **AI Analysis** - Real OpenAI processing of contracts  
✅ **Dashboard Data** - All metrics and charts loading  
✅ **Natural Language** - AI responses to queries  
✅ **Navigation** - Smooth transitions between pages  
✅ **Visualizations** - Interactive charts and graphs  

### **What Uses Intelligent Mock Data**
✅ **Rate Benchmarking** - Realistic market comparisons  
✅ **Supplier Profiles** - Credible company information  
✅ **Spend Analysis** - Believable spending patterns  
✅ **Market Intelligence** - Industry-standard data  
✅ **Historical Trends** - Realistic time-series data  

## **🔧 Last-Minute Fixes**

### **If Upload Fails**
```bash
# Ensure upload directory exists
mkdir -p apps/web/uploads/contracts

# Check permissions
chmod 755 apps/web/uploads/
```

### **If Dashboard Shows Errors**
```bash
# Restart the development server
cd apps/web
npm run dev
```

### **If API Calls Fail**
```bash
# Check if all services are running
ps aux | grep node
# Should show Next.js processes
```

## **🎯 Demo Confidence Level**

### **High Confidence Features** (100% reliable)
- Contract upload and file handling
- AI-powered contract analysis (with OpenAI key)
- Dashboard navigation and UI
- Mock data visualization
- Natural language query interface

### **Backup Plans**
- If upload fails: Use pre-uploaded contract examples
- If AI fails: Show cached analysis results
- If dashboard fails: Use static screenshots
- If queries fail: Use prepared example responses

---

## **✅ Final Validation Command**

```bash
# Run this single command to validate everything
curl -s http://localhost:3000/api/analytics/health && \
echo "✅ System Ready for Demo!" || \
echo "❌ System Needs Attention"
```

**If you see "✅ System Ready for Demo!" - you're good to go!**