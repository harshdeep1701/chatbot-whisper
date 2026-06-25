import { Component, OnInit } from '@angular/core';
import { AdminService, AdminUser } from '../../services/admin.service';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-admin',
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.scss']
})
export class AdminComponent implements OnInit {
  users: AdminUser[] = [];
  isLoading = true;
  error = '';
  actionMessage = '';

  constructor(
    private adminService: AdminService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    if (!this.authService.isAdmin()) {
      this.router.navigate(['/chat']);
      return;
    }
    this.loadUsers();
  }

  loadUsers(): void {
    this.isLoading = true;
    this.error = '';
    this.adminService.listUsers().subscribe({
      next: (res) => {
        this.users = res.users;
        this.isLoading = false;
      },
      error: (err) => {
        this.error = err.error?.error || 'Failed to load users. Are you an admin?';
        this.isLoading = false;
      }
    });
  }

  upgradeUser(user: AdminUser): void {
    this.adminService.upgradeToPremium(user.id).subscribe({
      next: () => {
        this.actionMessage = `${user.username} upgraded to premium`;
        this.loadUsers();
      },
      error: (err) => this.actionMessage = err.error?.error || 'Upgrade failed'
    });
  }

  downgradeUser(user: AdminUser): void {
    this.adminService.downgradeToFree(user.id).subscribe({
      next: () => {
        this.actionMessage = `${user.username} downgraded to free`;
        this.loadUsers();
      },
      error: (err) => this.actionMessage = err.error?.error || 'Downgrade failed'
    });
  }

  toggleAdmin(user: AdminUser): void {
    if (user.role === 'ADMIN') {
      this.adminService.removeAdmin(user.id).subscribe({
        next: () => {
          this.actionMessage = `${user.username} is no longer admin`;
          this.loadUsers();
        },
        error: (err) => this.actionMessage = err.error?.error || 'Failed'
      });
    } else {
      this.adminService.makeAdmin(user.id).subscribe({
        next: () => {
          this.actionMessage = `${user.username} is now an admin`;
          this.loadUsers();
        },
        error: (err) => this.actionMessage = err.error?.error || 'Failed'
      });
    }
  }
}
