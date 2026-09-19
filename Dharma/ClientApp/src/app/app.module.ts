// Importa BrowserModule, necesario para que Angular pueda ejecutarse en el navegador.
import { BrowserModule } from '@angular/platform-browser';

// Importa NgModule, que utilizaremos para definir el módulo principal de Angular.
import { NgModule } from '@angular/core';

// Importa FormsModule, que permite trabajar con formularios y utilizar herramientas como ngModel.
import { FormsModule } from '@angular/forms';

// Importa HttpClientModule, que permite realizar peticiones HTTP desde Angular.
import { HttpClientModule } from '@angular/common/http';

// Importa RouterModule, que permite configurar las rutas y la navegación de la aplicación.
import { RouterModule } from '@angular/router';

// Importa el componente principal de la aplicación.
import { AppComponent } from './app.component';

// Importa el componente encargado del menú de navegación.
import { NavMenuComponent } from './nav-menu/nav-menu.component';

// Importa el componente que representa la página principal.
import { HomeComponent } from './home/home.component';



// Importa el componente de usuarios.
import { UsuariosComponent } from './usuarios/usuarios.component';

import { AnadirUsuarioComponent } from './usuarios/agregar-usuario/agregar-usuario.component';

import { ModificarUsuarioComponent } from './usuarios/modificar-usuario/modificar-usuario.component';


import { EliminarUsuarioComponent } from './usuarios/eliminar-usuario/eliminar-usuario.component';




// Importa el componente de pruebas.
import { TestComponent } from './test/test.component';

// Importa el componente de aviones.
import { AvionesComponent } from './aviones/aviones.component';

// Importa el componente de barcos.
import { BarcosComponent } from './barcos/barcos.component';

// Importa el componente de satelites.
import { SatelitesComponent } from './satelites/satelites.component';

// @NgModule es un decorador de Angular.
// Sirve para configurar este módulo y decirle a Angular
// qué componentes pertenecen a él y qué módulos necesita.
@NgModule({
  declarations: [
    // Declaracion de los componentes que pertenecen a este módulo.
    AppComponent,
    NavMenuComponent,
    HomeComponent,
    UsuariosComponent,
    AnadirUsuarioComponent,
    ModificarUsuarioComponent,
    EliminarUsuarioComponent,
    TestComponent,
    AvionesComponent,
    BarcosComponent,
    SatelitesComponent
  ],

  // Indicamos los módulos que necesitamos utilizar dentro de este módulo
  imports: [
    // BrowserModule proporciona las funcionalidades necesarias para ejecutar Angular en el navegador.
    // withServerTransition está relacionado con Angular Universal
    // y permite trabajar con aplicaciones que utilizan renderizado
    // en el servidor.
    BrowserModule.withServerTransition({ appId: 'ng-cli-universal' }),

    // Permite realizar peticiones HTTP, por ejemplo, contra una API.
    HttpClientModule,

    // Permite utilizar funcionalidades relacionadas con formularios.
    FormsModule,
    RouterModule.forRoot([
      // Configura las rutas principales de la aplicación -> forRoot recibe un array donde cada objeto representa una ruta.

      // Si la URL está vacía ("/"), se muestra HomeComponent.
      // pathMatch: 'full' indica que la URL debe coincidir completamente con la ruta vacía.
      { path: '', component: HomeComponent, pathMatch: 'full' },




      // La URL "/usuarios" muestra UsuariosComponent.
      { path: 'usuarios', component: UsuariosComponent },

      // La URL "/aviones" muestra AvionesComponent.
      { path: 'aviones', component: AvionesComponent },

      // La URL "/barcos" muestra BarcosComponent.
      { path: 'barcos', component: BarcosComponent },

      // La URL "/satelites" muestra SatelitesComponent.
      { path: 'satelites', component: SatelitesComponent },

      // La URL "/modificar-usuario" muestra ModificarUsuarioComponent.
      { path: 'modificar-usuario', component: ModificarUsuarioComponent },


      // La URL "/modificar-usuario" muestra ModificarUsuarioComponent.
      { path: 'eliminar-usuario', component: EliminarUsuarioComponent },




      // La URL "/test" muestra TestComponent.
      { path: 'test', component: TestComponent }
    ])
  ],

  // Aquí se registran servicios para que Angular pueda utilizarlos mediante Dependency Injection.
  // (En este caso el array está vacío)
  providers: [],

  // Indica el componente raíz desde el que Angular inicia la aplicación.
  // En este caso, Angular comienza cargando AppComponent.
  bootstrap: [AppComponent]
})


// Define y exporta el módulo principal de nuestra aplicación.
export class AppModule { }

