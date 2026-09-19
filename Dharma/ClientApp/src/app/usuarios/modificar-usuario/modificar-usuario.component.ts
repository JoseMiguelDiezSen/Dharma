import { Component, Input, OnChanges } from '@angular/core';

@Component({
  selector: 'app-modificar-usuario',
  templateUrl: './modificar-usuario.component.html',
  styleUrls: ['./modificar-usuario.component.css']
})
export class ModificarUsuarioComponent implements OnChanges {

  @Input() abrir: boolean = false;

  modalModificarUsuario: boolean = false;
  mostrarPassword: boolean = false;

  ngOnChanges(): void {
    this.modalModificarUsuario = this.abrir;
  }

  editUser(): void {
  }

}
