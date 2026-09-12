import { Component } from '@angular/core';

@Component({
  selector: 'app-anadir-usuario',
  templateUrl: './agregar-usuario.component.html',
  styleUrls: ['./agregar-usuario.component.css']
})
export class AnadirUsuarioComponent {
  modalAgregarUsuario: boolean = false;
  usuarios: any[] = [];

  addUser(): void {
    this.modalAgregarUsuario = true;
  }

  editUser(): void {
  }

  deleteUser(): void {
  }
}
