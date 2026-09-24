using Dharma.Data;
using Dharma.Services;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// Conexión a la BBDD
var connection = builder.Configuration.GetConnectionString("ConexionSQL")
    ?? throw new InvalidOperationException("No se encontró la cadena de conexión 'ConexionSQL'.");

builder.Services.AddDbContext<DharmaDbContext>(options =>
    options.UseSqlServer(connection));

// Habilitar CORS
var corsPolicy = "CorsPolicy";
builder.Services.AddCors(options =>
{
    options.AddPolicy(name: corsPolicy, policy =>
    {
        policy.WithOrigins("http://localhost:4200", "https://localhost:4200")
              .SetIsOriginAllowed(origin => new Uri(origin).IsLoopback)
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

// Servicios de la capa de negocio
builder.Services.AddScoped<IUsuario, GestionUsuarios>();
builder.Services.AddHttpClient<IAviones, GestionAviones>();
builder.Services.AddHttpClient<ISatelites, GestionSatelites>();

// Servicio de Barcos en segundo plano (AISStream WebSocket)
builder.Services.AddSingleton<GestionBarcos>();
builder.Services.AddSingleton<IBarcos>(sp => sp.GetRequiredService<GestionBarcos>());
builder.Services.AddHostedService(sp => sp.GetRequiredService<GestionBarcos>());

// Controllers y OpenAPI
builder.Services.AddControllers();
builder.Services.AddOpenApi();

var app = builder.Build();

app.UseDefaultFiles();
app.MapStaticAssets();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();
app.UseCors(corsPolicy);
app.UseAuthorization();
app.MapControllers();
app.MapFallbackToFile("/index.html");

app.Run();
