/**
 * Word Document Service
 * Handles all interactions with the Word document via Office.js API
 */

/* global Word */

export interface Variable {
  name: string;
  value: string;
  placeholder: string;
}

export interface InsertOptions {
  location: 'selection' | 'start' | 'end' | 'paragraph-after' | 'paragraph-before';
  format?: 'html' | 'plain' | 'ooxml';
}

export interface DocumentStats {
  wordCount: number;
  paragraphCount: number;
  pageCount: number;
}

export interface Bookmark {
  name: string;
  range: Word.Range;
}

class WordService {
  private static instance: WordService;

  private constructor() {}

  static getInstance(): WordService {
    if (!WordService.instance) {
      WordService.instance = new WordService();
    }
    return WordService.instance;
  }

  /**
   * Insert text content at specified location
   */
  async insertText(text: string, options: InsertOptions = { location: 'selection' }): Promise<void> {
    return Word.run(async (context) => {
      const document = context.document;
      const selection = document.getSelection();

      let range: Word.Range;

      switch (options.location) {
        case 'start':
          range = document.body.getRange('Start');
          break;
        case 'end':
          range = document.body.getRange('End');
          break;
        case 'paragraph-after':
          range = selection.paragraphs.getLast().getRange('After');
          break;
        case 'paragraph-before':
          range = selection.paragraphs.getFirst().getRange('Before');
          break;
        default:
          range = selection;
      }

      if (options.format === 'html') {
        range.insertHtml(text, Word.InsertLocation.replace);
      } else if (options.format === 'ooxml') {
        range.insertOoxml(text, Word.InsertLocation.replace);
      } else {
        range.insertText(text, Word.InsertLocation.replace);
      }

      await context.sync();
    });
  }

  /**
   * Insert HTML content (preserves formatting)
   */
  async insertHtml(html: string, location: InsertOptions['location'] = 'selection'): Promise<void> {
    return this.insertText(html, { location, format: 'html' });
  }

  /**
   * Insert a clause with formatting
   */
  async insertClause(clause: {
    title: string;
    content: string;
    numbering?: string;
  }): Promise<void> {
    return Word.run(async (context) => {
      const selection = context.document.getSelection();
      
      // Build formatted HTML
      const html = `
        <h3 style="font-weight: bold; margin-bottom: 8px;">
          ${clause.numbering ? `${clause.numbering} ` : ''}${clause.title}
        </h3>
        <p style="margin-bottom: 12px;">${clause.content}</p>
      `;

      selection.insertHtml(html, Word.InsertLocation.end);
      await context.sync();
    });
  }

  /**
   * Insert full contract from template
   */
  async insertContract(template: {
    title: string;
    sections: Array<{
      heading: string;
      content: string;
      level: number;
    }>;
    styles?: {
      headingFont?: string;
      bodyFont?: string;
    };
  }): Promise<void> {
    return Word.run(async (context) => {
      const body = context.document.body;
      
      // Clear document if needed or insert at end
      body.clear();

      // Insert title
      const titlePara = body.insertParagraph(template.title, Word.InsertLocation.start);
      titlePara.styleBuiltIn = Word.Style.title;

      // Insert sections
      for (const section of template.sections) {
        // Insert heading
        const headingPara = body.insertParagraph(section.heading, Word.InsertLocation.end);
        headingPara.styleBuiltIn = this.getHeadingStyle(section.level);

        // Insert content
        const contentPara = body.insertParagraph(section.content, Word.InsertLocation.end);
        contentPara.styleBuiltIn = Word.Style.normal;
      }

      await context.sync();
    });
  }

  private getHeadingStyle(level: number): Word.Style {
    switch (level) {
      case 1: return Word.Style.heading1;
      case 2: return Word.Style.heading2;
      case 3: return Word.Style.heading3;
      case 4: return Word.Style.heading4;
      default: return Word.Style.heading1;
    }
  }

  /**
   * Get selected text from document
   */
  async getSelection(): Promise<string> {
    return Word.run(async (context) => {
      const selection = context.document.getSelection();
      selection.load('text');
      await context.sync();
      return selection.text;
    });
  }

  /**
   * Replace all variable placeholders in document
   * Variables are formatted as {{variableName}}
   */
  async replaceVariables(variables: Variable[]): Promise<number> {
    return Word.run(async (context) => {
      let replacementCount = 0;

      for (const variable of variables) {
        const searchResults = context.document.body.search(
          variable.placeholder,
          { matchCase: false, matchWholeWord: false }
        );
        searchResults.load('items');
        await context.sync();

        for (const result of searchResults.items) {
          result.insertText(variable.value, Word.InsertLocation.replace);
          replacementCount++;
        }
      }

      await context.sync();
      return replacementCount;
    });
  }

  /**
   * Find all variable placeholders in document
   */
  async findVariables(): Promise<string[]> {
    return Word.run(async (context) => {
      // Search for pattern {{...}}
      const searchResults = context.document.body.search(
        '{{*}}',
        { matchWildcards: true }
      );
      searchResults.load('items/text');
      await context.sync();

      const variables = searchResults.items.map((item) => {
        // Extract variable name from {{name}}
        const match = item.text.match(/\{\{(.+?)\}\}/);
        return match ? match[1] : '';
      }).filter(Boolean);

      // Return unique variables
      return [...new Set(variables)];
    });
  }

  /**
   * Get document statistics
   */
  async getDocumentStats(): Promise<DocumentStats> {
    return Word.run(async (context) => {
      const body = context.document.body;
      body.load(['text']);

      const paragraphs = body.paragraphs;
      paragraphs.load('items');

      await context.sync();

      const wordCount = body.text.split(/\s+/).filter(Boolean).length;
      const paragraphCount = paragraphs.items.length;

      // Page count requires loading document properties
      const docProps = context.document.properties;
      docProps.load('revision'); // Just to trigger a sync
      await context.sync();

      return {
        wordCount,
        paragraphCount,
        pageCount: 1, // Approximate - Word API doesn't directly expose page count
      };
    });
  }

  /**
   * Highlight text in document
   */
  async highlightText(searchText: string, color: string = 'Yellow'): Promise<void> {
    return Word.run(async (context) => {
      const searchResults = context.document.body.search(searchText, {
        matchCase: false,
      });
      searchResults.load('items');
      await context.sync();

      for (const result of searchResults.items) {
        result.font.highlightColor = color;
      }

      await context.sync();
    });
  }

  /**
   * Add comment to selected text
   */
  async addComment(commentText: string): Promise<void> {
    return Word.run(async (context) => {
      const selection = context.document.getSelection();
      selection.insertComment(commentText);
      await context.sync();
    });
  }

  /**
   * Insert table (for schedules, rate cards, etc.)
   */
  async insertTable(data: {
    headers: string[];
    rows: string[][];
  }): Promise<void> {
    return Word.run(async (context) => {
      const selection = context.document.getSelection();
      
      // Calculate dimensions
      const rowCount = data.rows.length + 1; // +1 for header
      const colCount = data.headers.length;

      // Insert table
      const table = selection.insertTable(rowCount, colCount, Word.InsertLocation.after, [
        data.headers,
        ...data.rows,
      ]);

      // Style header row
      const headerRow = table.rows.getFirst();
      headerRow.font.bold = true;
      headerRow.shadingColor = '#E0E0E0';

      // Apply table style
      table.styleBuiltIn = Word.Style.tableGrid;

      await context.sync();
    });
  }

  /**
   * Track changes enable/disable
   */
  async setTrackChanges(enabled: boolean): Promise<void> {
    return Word.run(async (context) => {
      context.document.properties.load('revision'); // Placeholder
      await context.sync();
      // Note: Track changes API may be limited
    });
  }

  /**
   * Insert page break
   */
  async insertPageBreak(): Promise<void> {
    return Word.run(async (context) => {
      const selection = context.document.getSelection();
      selection.insertBreak(Word.BreakType.page, Word.InsertLocation.after);
      await context.sync();
    });
  }

  /**
   * Insert signature block
   */
  async insertSignatureBlock(parties: Array<{
    name: string;
    title: string;
    company: string;
  }>): Promise<void> {
    return Word.run(async (context) => {
      const body = context.document.body;

      let html = '<div style="margin-top: 40px;">';
      html += '<h3>IN WITNESS WHEREOF</h3>';
      html += '<p>The parties have executed this Agreement as of the date first written above.</p>';
      html += '<table style="width: 100%; margin-top: 20px;">';
      
      for (let i = 0; i < parties.length; i += 2) {
        html += '<tr>';
        
        // First party in row
        html += `<td style="width: 45%; padding: 20px; vertical-align: top;">
          <p><strong>${parties[i].company}</strong></p>
          <p style="margin-top: 40px; border-top: 1px solid black; padding-top: 8px;">
            ${parties[i].name}<br/>
            ${parties[i].title}
          </p>
          <p>Date: ___________________</p>
        </td>`;
        
        // Second party in row (if exists)
        if (parties[i + 1]) {
          html += `<td style="width: 45%; padding: 20px; vertical-align: top;">
            <p><strong>${parties[i + 1].company}</strong></p>
            <p style="margin-top: 40px; border-top: 1px solid black; padding-top: 8px;">
              ${parties[i + 1].name}<br/>
              ${parties[i + 1].title}
            </p>
            <p>Date: ___________________</p>
          </td>`;
        }
        
        html += '</tr>';
      }
      
      html += '</table></div>';

      body.insertHtml(html, Word.InsertLocation.end);
      await context.sync();
    });
  }

  /**
   * Get document as base64 for saving to ConTigo
   */
  async getDocumentAsBase64(): Promise<string> {
    return Word.run(async (context) => {
      const body = context.document.body;
      const docx = body.getOoxml();
      await context.sync();
      return btoa(docx.value);
    });
  }
}

export const wordService = WordService.getInstance();
