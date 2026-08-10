import { getLocaleDateTimeFormat } from '@angular/common';
import { Component } from '@angular/core';


// Funcion decoradora
@Component({
  selector: 'test',
  templateUrl: './test.component.html'
})


export class TestComponent {

    // *** VARIABLES ***
    public mensajeBienvenida = "";
    public fechaActual = "";
    public listaCiudades: string[] = ["Madrid", "Paris", "Londres", "Milan"];

    // Lista de usuarios
    usuarios = [
      { id: 1, name: "Ismael", pais:"España", profesion:"Arquitecto" },
      { id: 2, name: "Roberto", pais: "Francia", profesion: "Profesor" },
      { id: 3, name: "Bruno", pais: "Noruega", profesion: "Camionero" },
      { id: 4, name: "Sergio", pais: "Portugal", profesion: "Taxista" },
      { id: 5, name: "Ivan", pais: "Bulgaria", profesion: "Policia" },
      { id: 6, name: "Ricardo", pais: "Panama", profesion: "Bombero" }
    ];

    //*** METODOS ***
    // Metodo ngIF
    public pruebaNgIf() {

        const date = new Date();
        let hora = date.getHours();
        let minutos = date.getMinutes();
        let segundos = date.getSeconds();

        let dia = date.getDay();
        let mes = date.getMonth();
        let anio = date.getFullYear();
    
        console.log("Fecha:" + dia + "/" + mes + "/" + anio);
        console.log("Hora:" + hora + ":" + minutos + ":" + segundos);

        // Definimos formatos para mostrarlo
        var time = hora + ":" + minutos + ":" + segundos;
        var currentDate = dia +"/"+ mes+"/"+ anio;

        // Hora del dia
        if (hora > 8 && hora < 12)
            this.mensajeBienvenida = "Buenos días, son las " + time;

        if (hora > 12 && hora < 21)
            this.mensajeBienvenida = "Buenas tardes, son las " + time;

        if (hora > 21 || hora < 8)
            this.mensajeBienvenida = "Buenas noches son las " + time +" del dia " + currentDate;

        console.log(this.mensajeBienvenida);
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


  // Motodo aux de Imprimir
  private getTagsHtml(tagName: keyof HTMLElementTagNameMap): string {

    const htmlStr: string[] = [];
    const elements = document.getElementsByTagName(tagName);

    for (let idx = 0; idx < elements.length; idx++) {

      htmlStr.push(elements[idx].outerHTML);

    }

    return htmlStr.join('\r\n');

  }

  // Metodo para imprimir
  imprimir(): void {

    //Imprimir en una linea
    //let printContent = window.print();

    const styleHtml = this.getTagsHtml('style');
    const linksHtml = this.getTagsHtml('link');

    let printContent, popUpWindow
    printContent = document.getElementById('print-section')!.innerHTML;

    popUpWindow = window.open('', '_blank', 'top=200,left=200,height=100%,width=auto');
    popUpWindow!.document.open();
    popUpWindow!.document.write(`

            <html>
                <head>
                  ${linksHtml}
                  ${styleHtml}
                </head>

            <body onload='window.print();window.close()' media="print">${printContent}</body>

            </html>

          `);

    popUpWindow!.document.close();

  }

  public cargarDatos() {
    //table.apply(this.lstCiudades);
  }

  // Metodo 2
  showName(int: number) {

    //$(document).ready(function () {

    //  $("#table").css("border", "1px solid yellow");

    //  console.log("Hecho");
    //}
  }

  // Metodo 3 (Obligatorio retorno bolean)
  checkName(int: number): boolean {
    // this.dialog.open(HomeComponent);
    return true;
  }


  }






