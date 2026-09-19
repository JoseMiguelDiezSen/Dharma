import { Component, Input, OnChanges } from '@angular/core';

@Component({
  selector: 'app-eliminar-usuario',
  templateUrl: './eliminar-usuario.component.html',
  styleUrls: ['./eliminar-usuario.component.css']
})
export class EliminarUsuarioComponent implements OnChanges {

  @Input() abrir: boolean = false;

  modalEliminarUsuario: boolean = false;

  ngOnChanges(): void {
    this.modalEliminarUsuario = this.abrir;
  }

  deleteUser(): void {
  }

}
