import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss']
})
export class RegisterComponent {
  username = '';
  email = '';
  password = '';
  confirmPassword = '';
  error = '';
  isLoading = false;

  constructor(private authService: AuthService, private router: Router) {}

  register(): void {
    if (!this.username.trim() || !this.email.trim() || !this.password.trim()) {
      this.error = 'Please fill in all fields';
      return;
    }

    if (this.password !== this.confirmPassword) {
      this.error = 'Passwords do not match';
      return;
    }

    if (this.password.length < 6) {
      this.error = 'Password must be at least 6 characters';
      return;
    }

    this.isLoading = true;
    this.error = '';

    this.authService.register(this.username.trim(), this.email.trim(), this.password).subscribe({
      next: (response) => {
        this.isLoading = false;
        if (response.success) {
          this.router.navigate(['/chat']);
        } else {
          this.error = response.error || 'Registration failed';
        }
      },
      error: (err) => {
        this.isLoading = false;
        this.error = err.error?.detail || err.error?.error || 'Connection error. Is the server running?';
      }
    });
  }
}
