import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AdminService, AdminUser } from './admin.service';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.scss'],
})
export class AdminComponent implements OnInit {
  users: AdminUser[] = [];
  isLoading = true;
  error = '';

  /** Inline confirm state */
  confirmAction: { userId: number; action: string; label: string } | null = null;

  constructor(private adminService: AdminService) {}

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.isLoading = true;
    this.error = '';
    this.adminService.listUsers().subscribe({
      next: res => {
        this.users = res.users;
        this.isLoading = false;
      },
      error: () => {
        this.error = 'Failed to load users.';
        this.isLoading = false;
      },
    });
  }

  // ── Actions with inline confirm ──────────────────────────

  private request(user: AdminUser, action: string, label: string): void {
    this.confirmAction = { userId: user.id, action, label };
  }

  requestUpgrade(user: AdminUser): void {
    this.request(user, 'premium', `Upgrade ${user.username} to premium?`);
  }

  requestDowngrade(user: AdminUser): void {
    this.request(user, 'free', `Downgrade ${user.username} to free?`);
  }

  requestMakeAdmin(user: AdminUser): void {
    this.request(user, 'make-admin', `Make ${user.username} an admin?`);
  }

  requestRemoveAdmin(user: AdminUser): void {
    this.request(user, 'remove-admin', `Remove admin role from ${user.username}?`);
  }

  confirmYes(): void {
    if (!this.confirmAction) return;
    const { userId, action } = this.confirmAction;
    this.confirmAction = null;

    switch (action) {
      case 'premium':
        this.adminService.upgradeToPremium(userId).subscribe(() => this.loadUsers());
        break;
      case 'free':
        this.adminService.downgradeToFree(userId).subscribe(() => this.loadUsers());
        break;
      case 'make-admin':
        this.adminService.makeAdmin(userId).subscribe(() => this.loadUsers());
        break;
      case 'remove-admin':
        this.adminService.removeAdmin(userId).subscribe(() => this.loadUsers());
        break;
    }
  }

  confirmNo(): void {
    this.confirmAction = null;
  }
}
