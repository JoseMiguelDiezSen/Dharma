import { getLocaleDateTimeFormat } from '@angular/common';
import { Component } from '@angular/core';


// Funcion decoradora
@Component({
  selector: 'test',
  templateUrl: './test.component.html'
})


export class TestComponent {

    // Declaracion de variables
    public mensajeBienvenida = "";
    public listaCiudades: string[] = ["Madrid", "Paris", "Londres", "Milan"];

    usuarios = [
      { id: 1, name: "Ismael", pais:"España", profesion:"Arquitecto" },
      { id: 2, name: "Roberto", pais: "Francia", profesion: "Profesor" },
      { id: 3, name: "Bruno", pais: "Noruega", profesion: "Camionero" },
      { id: 4, name: "Sergio", pais: "Portugal", profesion: "Taxista" },
      { id: 5, name: "Ivan", pais: "Bulgaria", profesion: "Policia" },
      { id: 6, name: "Ricardo", pais: "Panama", profesion: "Bombero" }
    ];


    // Metodo ngIF

    public pruebaNgIf() {

        const date = new Date();
        let hora = date.getHours();
        let minutos = date.getMinutes();
        let segundos = date.getSeconds();

        let dia = date.getDay();
        let mes = date.getUTCMonth();
        let anio = date.getFullYear();
    
        console.log("Fecha:" + dia + "/" + mes + "/" + anio);
        console.log("Hora:" + hora + ":" + minutos + ":" + segundos);

        var time = hora + ":" + minutos + ":" + segundos;

        // Hora del dia
        if (hora > 8 && hora < 12)
         this.mensajeBienvenida = "Buenos días";

        if (hora > 12 && hora < 21)
         this.mensajeBienvenida = "Buenas tardes, son las " + time;

        if (hora > 21 && hora < 8)
         this.mensajeBienvenida = "Buenas noches";
      }

    // Metodo ngFor
    public pruebaNgFor() {
        // mostrar listado
      }

    // Metodo ngSwitch
    public pruebaNgSwitch() {
    }

    // OPERACIONES CON ARRAYS
    // Añadir Item
    addItemToArray() {
      this.listaCiudades.push()
    }

    // Eliminar Item
    removeItemToArray() {
      this.listaCiudades.slice(1);
    }

    // Otros Ejemplos


    // EJEMPLO METODO QUE RECIBE PARAMETROS
    // Devuelve un string
    // (param1: typeValue, para2: typeValue) : type of return
    public test(id: number, nombre: string, email?: string): string {
      if (id != undefined)
        console.log();
      return nombre;
    }




  }






