import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-usuarios',
  templateUrl: './usuarios.component.html',
  styleUrls: ['./usuarios.component.css']
})

// Esta clase implementa OnInit que es 
export class UsuariosComponent implements OnInit {

  // VARIABLES
  title: string = 'Create'
  errorMessage: any;
  modelData: any = {};
  myAppUrl: string = "";
  id: number = 0;

  usuarios: any[] = [];
  modalAgregarUsuario: boolean = false;
  modalModificarUsuario: boolean = false;
  modalEliminarUsuario: boolean = false;
  // Almacena el usuario seleccionado en la fila de la tabla para enviarlo al modal
  usuarioSeleccionado: any = null;

  // ...
  // CONSTRUCTOR
  constructor(private http: HttpClient) {
  }

  // METODO OnInit Si implemento OnInit en la clase, debo declarar la funcion obligatoriamente
  ngOnInit() {

    this.getUsers();
  
  }
  // ADD USER
  public addUser() {

    console.log('Has pulsado CREAR USUARIO');
    this.modalAgregarUsuario = true;
  }

  // MODIFY USER: Recibe el usuario seleccionado en la fila y abre el modal
  public editUser(usuario: any) {
    console.log('Has pulsado MODIFICAR USUARIO', usuario);
    this.usuarioSeleccionado = usuario;
    this.modalModificarUsuario = true;
  }

  // DELETE USER: Recibe el usuario seleccionado en la fila y abre el modal de eliminación
  public deleteUser(usuario: any) {
    console.log('Has pulsado BORRAR USUARIO', usuario);
    this.usuarioSeleccionado = usuario;
    this.modalEliminarUsuario = true;
  }

  // GET USER BY ID
  public getUser() {
    console.log('GET usuario por ID');
  }

  // GET ALL USERS
  public getUsers() {

    
    this.http.get<any[]>('/api/Usuarios')
      .subscribe(response => {
        console.log(response);
        this.usuarios = response;
      });
  }
}


