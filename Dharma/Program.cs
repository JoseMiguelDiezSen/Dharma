using Dharma.Data;
using Dharma.Services;
using Microsoft.EntityFrameworkCore;
using System;

var builder = WebApplication.CreateBuilder(args);

// Configure DbContext using connection string from configuration
var connection = builder.Configuration.GetConnectionString("ConexionSQL");
builder.Services.AddDbContext<DharmaDbContext>(options => options.UseSqlServer(connection));

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
