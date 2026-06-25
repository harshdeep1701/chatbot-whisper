import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent {
  username = '';
  password = '';
  error = '';
  isLoading = false;

  constructor(private authService: AuthService, private router: Router) {}

  login(): void {
    if (!this.username.trim() || !this.password.trim()) {
      this.error = 'Please fill in all fields';
      return;
    }

    this.isLoading = true;
    this.error = '';

    this.authService.login(this.username.trim(), this.password).subscribe({
      next: (response) => {
        this.isLoading = false;
        if (response.success) {
          this.router.navigate(['/chat']);
        } else {
          this.error = response.error || 'Login failed';
        }
      },
      error: (err) => {
        this.isLoading = false;
        this.error = err.error?.error || 'Connection error. Is the server running?';
      }
    });
  }
}
