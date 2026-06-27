import { Pipe, PipeTransform, SecurityContext } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { marked } from 'marked';

/**
 * Converts Markdown text into safe rendered HTML.
 * Supports headings, tables, bold, italic, lists, code blocks,
 * links, blockquotes, and more.
 *
 * Usage:  {{ msg.content | markdown }}
 */
@Pipe({ name: 'markdown', standalone: true })
export class MarkdownPipe implements PipeTransform {

  constructor(private sanitizer: DomSanitizer) {
    // Configure marked for security
    marked.setOptions({
      breaks: true,       // respect line breaks
      gfm: true,          // GitHub-flavoured Markdown (tables, etc.)
    });
  }

  transform(value: string | null | undefined): SafeHtml {
    if (!value) {
      return '';
    }

    try {
      const html = marked.parse(value) as string;
      // Sanitize the output to prevent XSS attacks
      return this.sanitizer.sanitize(SecurityContext.HTML, html) || '';
    } catch {
      // Fallback: escape and return plain text if parsing fails
      return this.sanitizer.sanitize(SecurityContext.HTML, value) || '';
    }
  }
}
