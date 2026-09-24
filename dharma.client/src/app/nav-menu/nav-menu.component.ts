import { Component } from '@angular/core';

@Component({
    selector: 'app-nav-menu',
    templateUrl: './nav-menu.component.html',
    styleUrls: ['./nav-menu.component.css'],
    standalone: false
})
export class NavMenuComponent {
  isExpanded = false;

  // Rutas imagenes
  readonly imageLogo = "../../assets/imageButton.svg";
  jsmIcono = "../../assets/logoJSMTransparente.png"





  collapse() {
    this.isExpanded = false;
  }

  toggle() {
    this.isExpanded = !this.isExpanded;
  }
}
