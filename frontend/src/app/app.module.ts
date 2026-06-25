import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';

import { AppComponent } from './app.component';
import { AppRoutingModule } from './app-routing.module';
import { ChatComponent } from './components/chat/chat.component';
import { VoiceInputComponent } from './components/voice-input/voice-input.component';
import { QuotaIndicatorComponent } from './components/quota-indicator/quota-indicator.component';
import { SettingsComponent } from './components/settings/settings.component';
import { LoginComponent } from './components/login/login.component';
import { RegisterComponent } from './components/register/register.component';
import { AdminComponent } from './components/admin/admin.component';
import { AuthInterceptor } from './interceptors/auth.interceptor';
import { MarkdownPipe } from './pipes/markdown.pipe';

@NgModule({
  declarations: [
    AppComponent,
    ChatComponent,
    VoiceInputComponent,
    QuotaIndicatorComponent,
    SettingsComponent,
    LoginComponent,
    RegisterComponent,
    AdminComponent,
    MarkdownPipe
  ],
  imports: [
    BrowserModule,
    FormsModule,
    HttpClientModule,
    AppRoutingModule
  ],
  providers: [
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true }
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
