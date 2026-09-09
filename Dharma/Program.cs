using Dharma.Data;
using Dharma.Services;
using Microsoft.EntityFrameworkCore;
using System;

var builder = WebApplication.CreateBuilder(args);

// Conexion a la BBDD
var connection = builder.Configuration.GetConnectionString("ConexionSQL")
    ?? throw new InvalidOperationException("No se encontró la cadena de conexión 'ConexionSQL'.");

builder.Services.AddDbContext<DharmaDbContext>(options =>
    options.UseSqlServer(connection));

// HABILITAR **CORS**
var _policyName = "CorsPolicy";

builder.Services.AddCors(options =>
{
    options.AddPolicy(name: _policyName, builder =>
    {
        builder.WithOrigins("http://localhost:4200").AllowAnyHeader().AllowAnyMethod();
    });
});

// Se registran los servicios de la capa de negocio (GestionUsuarios) para que puedan ser inyectados
builder.Services.AddScoped<IUsuario, GestionUsuarios>();



// Add services to the container.

builder.Services.AddControllersWithViews();

var app = builder.Build();


app.UseCors(_policyName);




// Configure the HTTP request pipeline.
if (!app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
    // The default HSTS value is 30 days. You may want to change this for production scenarios, see https://aka.ms/aspnetcore-hsts.
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseStaticFiles();
app.UseRouting();


app.MapControllerRoute(
    name: "default",
    pattern: "{controller}/{action=Index}/{id?}");

app.MapFallbackToFile("index.html"); ;

app.Run();
