import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { ToastList } from './core/notifications/toast-list';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastList],
  templateUrl: './app.html',
})
export class App {}
