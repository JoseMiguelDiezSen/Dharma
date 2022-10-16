import { Component } from '@angular/core';

// Función decoradora
@Component({
  selector: 'shop',
  templateUrl: './shop.component.html'
})

// Clase Chat Component
export class ShopComponent {

  // Declaración de Variables Principales
  public currentCount = 0;
  public nombre = "Jose Miguel Diez Sen";
  public lstCiudades: string[] = ["Madrid", "Los Angeles", "Paris"];
  //public const name = "Jose";

  // Rutas imagenes
  readonly imageButton = "../../assets/imageButton.svg";
  jsmIcon = "../../assets/logoJSMTransparente.png"

  // Constructor
  //constructor(private formBuilder: FormBuilder) {

  //  this.form = this.formBuilder.group({

  //    id: 0,
  //    nombre: ['', [Validators.required, Validators.minLength(10)]],
  //    password: ['', [Validators.required, Validators.maxLength(16)]],

  //  })

  //}


  //private readonly dialog MatDialog

  // Metodo 1
  public cambiaNombre() {
    this.nombre = "bors1One2022";
  }

  public abrir() {
    this.nombre = "Abierto";
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
  }

  // Metodo 3 (Obligatorio retorno bolean)
  checkName(int: number): boolean {
    // this.dialog.open(HomeComponent);
    return true;
  }

}
