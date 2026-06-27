import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from './core/auth/auth.service';
import { SpeechService, SpeechSettings } from './shared/services/speech.service';
import { UserInfo } from './core/models/auth.models';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  title = 'Cosmo-Chat';
  showSettings = false;
  currentUser: UserInfo | null = null;
  isAdmin = false;
  sidebarOpen = false;

  constructor(
    private authService: AuthService,
    private router: Router,
    private speechService: SpeechService,
  ) {}

  ngOnInit(): void {
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
      this.isAdmin = this.authService.isAdmin();
    });
  }

  toggleSettings(): void {
    this.showSettings = !this.showSettings;
  }

  toggleSidebar(): void {
    this.sidebarOpen = !this.sidebarOpen;
  }

  closeSidebar(): void {
    this.sidebarOpen = false;
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  isAuthPage(): boolean {
    return this.router.url === '/login' || this.router.url === '/register';
  }

  getSettings(): SpeechSettings {
    return this.speechService.getSettings();
  }

  setSttProvider(provider: 'browser' | 'whisper'): void {
    const s = this.getSettings();
    s.sttProvider = provider;
    localStorage.setItem('cosmo-chat-settings', JSON.stringify(s));
  }

  setTtsProvider(provider: 'browser' | 'server'): void {
    const s = this.getSettings();
    s.ttsProvider = provider;
    localStorage.setItem('cosmo-chat-settings', JSON.stringify(s));
  }
}
