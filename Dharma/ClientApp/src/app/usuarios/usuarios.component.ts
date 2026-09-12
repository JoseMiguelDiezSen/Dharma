import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'usuarios',
  templateUrl: './usuarios.component.html'
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

  // ...
  // CONSTRUCTOR
  constructor(private http: HttpClient) {
  }

  // METODO OnInit Si implemento OnInit en la clase, debo declarar la funcion obligatoriamente
  ngOnInit() {

    this.getUsers();
    //let headers = new Headers();
    //headers.append('Content-Type', 'application/json; charset=utf-8');
    //this.http.get(this.myAppUrl + "api/APIController/" + this.id, { headers: headers })
    //  .subscribe((res: Response) => {
    //    self.modelData = JSON.parse(res._body);
    //  });
  }
  // ADD USER
  public addUser() {

    console.log('Has pulsado CREAR USUARIO');
    this.modalAgregarUsuario = true;
  }

  // MODIFY USER
  public editUser() {
    console.log('Has pulsado MODIFICAR USUARIO');
    this.modalModificarUsuario = true;
  }

  // DELETE USER
  public deleteUser() {
    console.log('Has pulsado BORRAR USUARIO');
  }

  // GET USER BY ID
  public getUser() {
    console.log('GET usuario por ID');
  }

  // GET ALL USERS
  public getUsers() {

    console.log('ENTRANDO EN GET USERS');
    this.http.get<any[]>('/api/Usuarios')
      .subscribe(response => {
        console.log(response);
        this.usuarios = response;
      });
  }
}


