import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService, UserInfo } from './services/auth.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  title = 'ChatBot Whisper';
  showSettings = false;
  currentUser: UserInfo | null = null;

  constructor(private authService: AuthService, private router: Router) {}

  ngOnInit(): void {
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
    });
  }

  toggleSettings(): void {
    this.showSettings = !this.showSettings;
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  isAuthPage(): boolean {
    return this.router.url === '/login' || this.router.url === '/register';
  }
}
