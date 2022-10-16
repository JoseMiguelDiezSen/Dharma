using Arcadia.Models;
using Microsoft.EntityFrameworkCore;
using System;

var builder = WebApplication.CreateBuilder(args);

// MODELO (1) CADENA DE CONEXION (directamente)
var connection = "Server=DESKTOP-TP04RI8;database=JsmApp;Trusted_Connection=True";
builder.Services.AddDbContext<AppDbContext>(options => options.UseSqlServer(connection));

// MODELO (2) CADENA DE CONEXION (definida en el appSettings)
//builder.Services.AddDbContext<AppDbContext>(FileOptions =>
//{
//    FileOptions.UseSqlServer(builder.Configuration.GetConnectionString("ConexionSql"));
//});

// HABILITAR **CORS**
var _policyName = "CorsPolicy";

builder.Services.AddCors(options =>
{
    options.AddPolicy(name: _policyName, builder =>
    {
        builder.WithOrigins("http://localhost:4200").AllowAnyHeader().AllowAnyMethod();
    });
});

// Esto no se si es asi
builder.Services.AddScoped<IUsuario, RepositorioUsuarios>();



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
