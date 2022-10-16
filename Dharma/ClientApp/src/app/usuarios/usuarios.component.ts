import { Component, OnInit } from '@angular/core';


@Component({
  selector: 'usuarios',
  templateUrl: './usuarios.component.html'
})

// Esta clase implementa OnInit que es 
export class UsuariosComponent implements OnInit{

        // VARIABLES
        title: string = 'Create'
        errorMessage: any;
        modelData: any = {};
        myAppUrl: string = "";
        id: number = 0;

        // CONSTRUCTOR
        //constructor(private _avRoute: ActivatedRoute, public http: Http, private _router: Router, @Inject('BASE_URL') baseUrl: string) {
        //  debugger;
        //  this.myAppUrl = baseUrl;
        //  if (this._avRoute.snapshot.params["id"]) {
        //    this.id = this._avRoute.snapshot.params["id"];
        //  }
        //}

        // METODO OnInit Si implemento OnInit en la clase, debo declarar la funcion obligatoriamente
        ngOnInit() {
          //let headers = new Headers();
          //headers.append('Content-Type', 'application/json; charset=utf-8');
          //this.http.get(this.myAppUrl + "api/APIController/" + this.id, { headers: headers })
          //  .subscribe((res: Response) => {
          //    self.modelData = JSON.parse(res._body);
          //  });
        }

        // CREATE USER
        public add() {
          // mostrar listado
        }
    }


