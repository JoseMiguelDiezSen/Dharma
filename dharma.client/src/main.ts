// Importa enableProdMode, que permite activar el modo producción de Angular.
// En producción Angular realiza algunas optimizaciones y desactiva comprobaciones
// propias del modo desarrollo.
import { enableProdMode } from '@angular/core';

// Importa platformBrowserDynamic, que se encarga de arrancar Angular
// dentro del navegador.
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';

// Importa el módulo principal de nuestra aplicación Angular.
// Este módulo será el punto de entrada de nuestra aplicación.
import { AppModule } from './app/app.module';

// Importa la configuración del entorno actual (desarrollo, producción, etc.).
import { environment } from './environments/environment';


// Obtiene la URL base desde el elemento <base> del index.html.
// Por ejemplo, si nuestra aplicación está publicada en:
// https://servidor/mi-app/
// esta función devolverá esa URL.
export function getBaseUrl() {
  return document.getElementsByTagName('base')[0].href;
}


// Definimos un proveedor de Angular llamado BASE_URL.
// Otros componentes o servicios pueden solicitar este valor mediante
// inyección de dependencias.
//
// useFactory indica que el valor se obtiene ejecutando getBaseUrl().
const providers = [
  { provide: 'BASE_URL', useFactory: getBaseUrl, deps: [] }
];


// Comprobamos si la aplicación está configurada para producción.
// Si es así, activamos el modo producción de Angular.
if (environment.production) {
  enableProdMode();
}


// ARRANQUE DE LA APLICACIÓN.
//
// platformBrowserDynamic() prepara Angular para ejecutarse en el navegador.
// bootstrapModule(AppModule) le dice:
// "Arranca mi aplicación utilizando AppModule como módulo principal."
//
// Si durante el arranque ocurre algún error, lo mostramos en la consola.
platformBrowserDynamic(providers).bootstrapModule(AppModule)
  .catch(err => console.log(err));
