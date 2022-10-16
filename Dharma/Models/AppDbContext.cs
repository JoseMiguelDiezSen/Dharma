using Microsoft.EntityFrameworkCore;

namespace Arcadia.Models
{
    public class AppDbContext : DbContext
    {
        // Constructor
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) {
       
        // Nothing      
        }

        public DbSet <Usuario>? Usuarios { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder) {
            
            //modelBuilder.Entity<Usuario>().ToTable("UsuariosDharma");

            //modelBuilder.Entity<Usuario>().HasData(new Usuario
            //{
            //    Id = 1,
            //    Nombre = "Jose Miguel",
            //    password = "josemi89",
            //    telefono = 636041446,
            //    direccion = "C/ La Braille 16"
            //},

            //new Usuario
            //{
            //    Id = 2,
            //    Nombre = "Bartolo",
            //    password = "bartolo78",
            //    telefono = 987986797,
            //    direccion = "C/ La Lazarillo 29"
            //});

        }
    }
}
