/**
 * PDF Export Service for Negotiation Prep Dashboard
 * Generates professional PDF reports with charts, talking points, and scenarios
 */

import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

export interface PDFExportOptions {
  includeCoverPage?: boolean
  includeExecutiveSummary?: boolean
  includeCharts?: boolean
  includeTalkingPoints?: boolean
  includeScenarios?: boolean
  includeMarketIntelligence?: boolean
  companyName?: string
  preparedBy?: string
  preparedFor?: string
}

export interface NegotiationData {
  role: string
  level: string
  location: string
  currentRate: number
  targetRate: number
  marketMedian: number
  percentile: number
  potentialSavings: number
  talkingPoints?: string[]
  scenarios?: Array<{
    name: string
    rate: number
    savings: number
  }>
}

export class PDFExportService {
  private pdf: jsPDF
  private currentY: number = 20
  private pageHeight: number = 280
  private margin: number = 20

  constructor() {
    this.pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    })
  }

  /**
   * Generate complete negotiation prep PDF
   */
  async generatePDF(
    data: NegotiationData,
    options: PDFExportOptions = {}
  ): Promise<Blob> {
    const {
      includeCoverPage = true,
      includeExecutiveSummary = true,
      includeCharts = true,
      includeTalkingPoints = true,
      includeScenarios = true,
      includeMarketIntelligence = true,
      companyName = 'Your Company',
      preparedBy = 'Procurement Team',
      preparedFor = 'Negotiation Team'
    } = options

    // Cover Page
    if (includeCoverPage) {
      this.addCoverPage(data, companyName, preparedBy, preparedFor)
      this.addPage()
    }

    // Executive Summary
    if (includeExecutiveSummary) {
      this.addExecutiveSummary(data)
      this.addPage()
    }

    // Market Intelligence
    if (includeMarketIntelligence) {
      this.addMarketIntelligence(data)
      this.addPage()
    }

    // Charts
    if (includeCharts) {
      await this.addCharts()
      this.addPage()
    }

    // Talking Points
    if (includeTalkingPoints && data.talkingPoints) {
      this.addTalkingPoints(data.talkingPoints)
      this.addPage()
    }

    // Scenarios
    if (includeScenarios && data.scenarios) {
      this.addScenarios(data.scenarios)
    }

    return this.pdf.output('blob')
  }

  /**
   * Add cover page with branding
   */
  private addCoverPage(
    data: NegotiationData,
    companyName: string,
    preparedBy: string,
    preparedFor: string
  ): void {
    // Company name/logo area
    this.pdf.setFontSize(24)
    this.pdf.setFont('helvetica', 'bold')
    this.pdf.text(companyName, 105, 60, { align: 'center' })

    // Title
    this.pdf.setFontSize(32)
    this.pdf.setTextColor(41, 128, 185) // Blue
    this.pdf.text('Negotiation Prep', 105, 90, { align: 'center' })
    this.pdf.text('Report', 105, 105, { align: 'center' })

    // Subtitle
    this.pdf.setFontSize(16)
    this.pdf.setTextColor(0, 0, 0)
    this.pdf.setFont('helvetica', 'normal')
    this.pdf.text(`${data.role} - ${data.level}`, 105, 125, { align: 'center' })
    this.pdf.text(data.location, 105, 135, { align: 'center' })

    // Metadata box
    this.pdf.setDrawColor(200, 200, 200)
    this.pdf.rect(40, 160, 130, 50)

    this.pdf.setFontSize(12)
    this.pdf.text('Prepared By:', 45, 170)
    this.pdf.setFont('helvetica', 'bold')
    this.pdf.text(preparedBy, 45, 177)

    this.pdf.setFont('helvetica', 'normal')
    this.pdf.text('Prepared For:', 45, 187)
    this.pdf.setFont('helvetica', 'bold')
    this.pdf.text(preparedFor, 45, 194)

    this.pdf.setFont('helvetica', 'normal')
    this.pdf.text('Date:', 45, 204)
    this.pdf.setFont('helvetica', 'bold')
    this.pdf.text(new Date().toLocaleDateString(), 45, 211)

    // Footer
    this.pdf.setFontSize(10)
    this.pdf.setFont('helvetica', 'italic')
    this.pdf.setTextColor(128, 128, 128)
    this.pdf.text('Confidential - For Internal Use Only', 105, 270, { align: 'center' })
  }

  /**
   * Add executive summary section
   */
  private addExecutiveSummary(data: NegotiationData): void {
    this.addSectionTitle('Executive Summary')

    this.pdf.setFontSize(11)
    this.pdf.setFont('helvetica', 'normal')

    const summary = [
      `This report provides a comprehensive analysis for negotiating rates for ${data.role} - ${data.level} positions in ${data.location}.`,
      '',
      `Current Rate: CHF ${data.currentRate.toLocaleString()} per day`,
      `Target Rate: CHF ${data.targetRate.toLocaleString()} per day`,
      `Market Median: CHF ${data.marketMedian.toLocaleString()} per day`,
      '',
      `Your current rate is at the ${data.percentile.toFixed(0)}th percentile of the market.`,
      `Potential annual savings: CHF ${data.potentialSavings.toLocaleString()}`,
      '',
      `This report includes market intelligence, negotiation strategies, talking points, and scenario analysis to support your negotiation efforts.`
    ]

    summary.forEach(line => {
      if (this.currentY > this.pageHeight - 20) {
        this.addPage()
      }
      this.pdf.text(line, this.margin, this.currentY)
      this.currentY += line === '' ? 3 : 6
    })
  }

  /**
   * Add market intelligence section
   */
  private addMarketIntelligence(data: NegotiationData): void {
    this.addSectionTitle('Market Intelligence')

    // Market position box
    this.pdf.setFillColor(240, 248, 255)
    this.pdf.rect(this.margin, this.currentY, 170, 40, 'F')

    this.pdf.setFontSize(12)
    this.pdf.setFont('helvetica', 'bold')
    this.pdf.text('Market Position', this.margin + 5, this.currentY + 8)

    this.pdf.setFontSize(10)
    this.pdf.setFont('helvetica', 'normal')
    
    const positionText = data.percentile > 75 
      ? 'Above Market (Expensive)' 
      : data.percentile < 25 
      ? 'Below Market (Competitive)' 
      : 'At Market'
    
    this.pdf.text(`Position: ${positionText}`, this.margin + 5, this.currentY + 16)
    this.pdf.text(`Percentile: ${data.percentile.toFixed(0)}th`, this.margin + 5, this.currentY + 23)
    this.pdf.text(`Potential Savings: CHF ${data.potentialSavings.toLocaleString()}`, this.margin + 5, this.currentY + 30)

    this.currentY += 50

    // Rate comparison table
    this.addTable([
      ['Metric', 'Value'],
      ['Current Rate', `CHF ${data.currentRate.toLocaleString()}`],
      ['Target Rate', `CHF ${data.targetRate.toLocaleString()}`],
      ['Market Median', `CHF ${data.marketMedian.toLocaleString()}`],
      ['Difference from Median', `CHF ${(data.currentRate - data.marketMedian).toLocaleString()}`]
    ])
  }

  /**
   * Add charts section (captures from DOM)
   */
  private async addCharts(): Promise<void> {
    this.addSectionTitle('Rate Trends')

    // Find chart element in DOM
    const chartElement = document.querySelector('[data-chart="rate-trends"]') as HTMLElement
    
    if (chartElement) {
      try {
        const canvas = await html2canvas(chartElement, {
          scale: 2,
          backgroundColor: '#ffffff'
        })

        const imgData = canvas.toDataURL('image/png')
        const imgWidth = 170
        const imgHeight = (canvas.height * imgWidth) / canvas.width

        if (this.currentY + imgHeight > this.pageHeight - 20) {
          this.addPage()
        }

        this.pdf.addImage(imgData, 'PNG', this.margin, this.currentY, imgWidth, imgHeight)
        this.currentY += imgHeight + 10
      } catch (error) {
        console.error('Error capturing chart:', error)
        this.pdf.setFontSize(10)
        this.pdf.text('Chart could not be captured', this.margin, this.currentY)
        this.currentY += 10
      }
    } else {
      this.pdf.setFontSize(10)
      this.pdf.text('No chart data available', this.margin, this.currentY)
      this.currentY += 10
    }
  }

  /**
   * Add talking points section
   */
  private addTalkingPoints(points: string[]): void {
    this.addSectionTitle('Negotiation Talking Points')

    this.pdf.setFontSize(10)
    this.pdf.setFont('helvetica', 'normal')

    points.forEach((point, index) => {
      if (this.currentY > this.pageHeight - 20) {
        this.addPage()
      }

      const bullet = `${index + 1}.`
      this.pdf.text(bullet, this.margin, this.currentY)
      
      const lines = this.pdf.splitTextToSize(point, 160)
      lines.forEach((line: string, lineIndex: number) => {
        this.pdf.text(line, this.margin + 10, this.currentY + (lineIndex * 5))
      })
      
      this.currentY += (lines.length * 5) + 3
    })
  }

  /**
   * Add scenarios section
   */
  private addScenarios(scenarios: Array<{ name: string; rate: number; savings: number }>): void {
    this.addSectionTitle('Scenario Analysis')

    const tableData = [
      ['Scenario', 'Rate (CHF)', 'Annual Savings (CHF)'],
      ...scenarios.map(s => [
        s.name,
        s.rate.toLocaleString(),
        s.savings.toLocaleString()
      ])
    ]

    this.addTable(tableData)
  }

  /**
   * Helper: Add section title
   */
  private addSectionTitle(title: string): void {
    if (this.currentY > this.pageHeight - 30) {
      this.addPage()
    }

    this.pdf.setFontSize(16)
    this.pdf.setFont('helvetica', 'bold')
    this.pdf.setTextColor(41, 128, 185)
    this.pdf.text(title, this.margin, this.currentY)
    
    this.pdf.setDrawColor(41, 128, 185)
    this.pdf.setLineWidth(0.5)
    this.pdf.line(this.margin, this.currentY + 2, 190, this.currentY + 2)
    
    this.currentY += 12
    this.pdf.setTextColor(0, 0, 0)
  }

  /**
   * Helper: Add table
   */
  private addTable(data: string[][]): void {
    const colWidth = 170 / data[0].length
    const rowHeight = 8

    data.forEach((row, rowIndex) => {
      if (this.currentY + rowHeight > this.pageHeight - 20) {
        this.addPage()
      }

      // Header row
      if (rowIndex === 0) {
        this.pdf.setFillColor(41, 128, 185)
        this.pdf.setTextColor(255, 255, 255)
        this.pdf.setFont('helvetica', 'bold')
      } else {
        const fillColor = rowIndex % 2 === 0 ? 245 : 255;
        this.pdf.setFillColor(fillColor, fillColor, fillColor)
        this.pdf.setTextColor(0, 0, 0)
        this.pdf.setFont('helvetica', 'normal')
      }

      this.pdf.rect(this.margin, this.currentY - 5, 170, rowHeight, 'F')

      row.forEach((cell, colIndex) => {
        this.pdf.setFontSize(9)
        this.pdf.text(cell, this.margin + (colIndex * colWidth) + 2, this.currentY)
      })

      this.currentY += rowHeight
    })

    this.currentY += 5
  }

  /**
   * Helper: Add new page
   */
  private addPage(): void {
    this.pdf.addPage()
    this.currentY = 20
  }

  /**
   * Download PDF
   */
  downloadPDF(filename: string = 'negotiation-prep-report.pdf'): void {
    this.pdf.save(filename)
  }
}
