import { NextRequest, NextResponse } from 'next/server';

/**
 * Connection Test API
 * Tests all system connections and data flow
 */

export async function GET(request: NextRequest) {
  const results = {
    timestamp: new Date().toISOString(),
    overall: 'unknown',
    tests: {} as Record<string, any>
  };

  try {
    // Test 1: Database Connection
    try {
      const { contractService } = await import('data-orchestration');
      const dbTest = await contractService.healthCheck();
      results.tests.database = {
        status: dbTest ? 'connected' : 'failed',
        message: dbTest ? 'Database connection successful' : 'Database connection failed'
      };
    } catch (error) {
      results.tests.database = {
        status: 'error',
        message: `Database test error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }

    // Test 2: Rate Card Intelligence Service
    try {
      const { rateCardIntelligenceService } = await import('data-orchestration');
      const rateTest = await rateCardIntelligenceService.healthCheck();
      results.tests.rateIntelligence = {
        status: rateTest ? 'connected' : 'failed',
        message: rateTest ? 'Rate intelligence service operational' : 'Rate intelligence service failed'
      };
    } catch (error) {
      results.tests.rateIntelligence = {
        status: 'error',
        message: `Rate intelligence test error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }

    // Test 3: Data Standardization Service
    try {
      const { dataStandardizationService } = await import('data-orchestration');
      const standardizationTest = await dataStandardizationService.healthCheck();
      results.tests.dataStandardization = {
        status: standardizationTest ? 'connected' : 'failed',
        message: standardizationTest ? 'Data standardization service operational' : 'Data standardization service failed'
      };
    } catch (error) {
      results.tests.dataStandardization = {
        status: 'error',
        message: `Data standardization test error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }

    // Test 4: Rate Card Management Service
    try {
      const { rateCardManagementService } = await import('data-orchestration');
      const managementTest = await rateCardManagementService.healthCheck();
      results.tests.rateManagement = {
        status: managementTest ? 'connected' : 'failed',
        message: managementTest ? 'Rate management service operational' : 'Rate management service failed'
      };
    } catch (error) {
      results.tests.rateManagement = {
        status: 'error',
        message: `Rate management test error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }

    // Test 5: OpenAI Integration
    try {
      const hasOpenAI = !!process.env.OPENAI_API_KEY;
      results.tests.openai = {
        status: hasOpenAI ? 'connected' : 'not_configured',
        message: hasOpenAI ? 'OpenAI API key configured' : 'OpenAI API key not configured'
      };
    } catch (error) {
      results.tests.openai = {
        status: 'error',
        message: `OpenAI test error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }

    // Test 6: File Upload Directory
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      const uploadDir = path.join(process.cwd(), 'uploads', 'contracts');
      
      try {
        await fs.access(uploadDir);
        results.tests.fileSystem = {
          status: 'connected',
          message: 'Upload directory accessible',
          path: uploadDir
        };
      } catch {
        await fs.mkdir(uploadDir, { recursive: true });
        results.tests.fileSystem = {
          status: 'created',
          message: 'Upload directory created',
          path: uploadDir
        };
      }
    } catch (error) {
      results.tests.fileSystem = {
        status: 'error',
        message: `File system test error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }

    // Test 7: Analytics APIs
    try {
      // Test internal API endpoints
      const testEndpoints = [
        '/api/analytics/rate-intelligence?action=health',
        '/api/analytics/data-standardization?action=health',
        '/api/analytics/rate-management?action=health'
      ];

      const apiTests = await Promise.allSettled(
        testEndpoints.map(async (endpoint) => {
          try {
            const response = await fetch(`${request.nextUrl.origin}${endpoint}`);
            return {
              endpoint,
              status: response.ok ? 'connected' : 'failed',
              statusCode: response.status
            };
          } catch (error) {
            return {
              endpoint,
              status: 'error',
              error: error instanceof Error ? error.message : 'Unknown error'
            };
          }
        })
      );

      results.tests.analyticsAPIs = {
        status: 'tested',
        endpoints: apiTests.map(result => 
          result.status === 'fulfilled' ? result.value : { status: 'error', error: result.reason }
        )
      };
    } catch (error) {
      results.tests.analyticsAPIs = {
        status: 'error',
        message: `Analytics API test error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }

    // Calculate overall status
    const testStatuses = Object.values(results.tests).map(test => test.status);
    const hasErrors = testStatuses.includes('error') || testStatuses.includes('failed');
    const hasWarnings = testStatuses.includes('not_configured');
    
    if (hasErrors) {
      results.overall = 'error';
    } else if (hasWarnings) {
      results.overall = 'warning';
    } else {
      results.overall = 'success';
    }

    // Add summary
    results.summary = {
      totalTests: Object.keys(results.tests).length,
      passed: testStatuses.filter(s => s === 'connected' || s === 'created' || s === 'tested').length,
      failed: testStatuses.filter(s => s === 'error' || s === 'failed').length,
      warnings: testStatuses.filter(s => s === 'not_configured').length
    };

    return NextResponse.json({
      success: true,
      data: results,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Connection test failed:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Connection test failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        results
      },
      { status: 500 }
    );
  }
}