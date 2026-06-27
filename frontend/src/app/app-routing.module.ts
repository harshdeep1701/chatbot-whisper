import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ChatComponent } from './features/chat/chat.component';
import { authGuard } from './core/auth/auth.guard';
import { adminGuard } from './core/auth/admin.guard';

const routes: Routes = [
  { path: '', redirectTo: '/chat', pathMatch: 'full' },
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login.component').then(m => m.LoginComponent),
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./features/auth/register/register.component').then(m => m.RegisterComponent),
  },
  { path: 'chat', component: ChatComponent, canActivate: [authGuard] },
  {
    path: 'voice',
    loadComponent: () =>
      import('./features/voice/voice-shell.component').then(m => m.VoiceShellComponent),
    canActivate: [authGuard],
  },
  {
    path: 'admin',
    loadComponent: () =>
      import('./features/admin/admin.component').then(m => m.AdminComponent),
    canActivate: [authGuard, adminGuard],
  },
  {
    path: 'unauthorized',
    loadComponent: () =>
      import('./features/auth/unauthorized/unauthorized.component').then(m => m.UnauthorizedComponent),
  },
  { path: '**', redirectTo: '/chat' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
