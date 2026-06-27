import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-unauthorized',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="unauthorized">
      <i class="fas fa-lock"></i>
      <h1>403 — Access Denied</h1>
      <p>You do not have permission to view this page.</p>
      <a routerLink="/chat">Go to Chat</a>
    </div>
  `,
  styles: [
    `
      .unauthorized {
        text-align: center;
        padding: 80px 20px;
        color: var(--text-primary, #333);
      }
      i { font-size: 48px; color: #dc3545; margin-bottom: 16px; }
      h1 { font-size: 24px; margin: 0 0 8px; }
      p { color: var(--text-secondary, #666); margin: 0 0 16px; }
      a { color: var(--primary, #7c5cbf); }
    `,
  ],
})
export class UnauthorizedComponent {}
