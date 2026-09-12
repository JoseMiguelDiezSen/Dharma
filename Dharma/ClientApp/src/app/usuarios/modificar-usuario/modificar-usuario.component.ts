import { Component } from '@angular/core';

@Component({
  selector: 'app-modificar-usuario',
  templateUrl: './modificar-usuario.component.html',
  styleUrls: ['./modificar-usuario.component.css']
})
export class ModificarUsuarioComponent {

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
