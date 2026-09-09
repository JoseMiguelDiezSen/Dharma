
using Dharma.Models;
using Microsoft.EntityFrameworkCore;

namespace Dharma.Data
{
    public class DharmaDbContext : DbContext
    {
        // Constructor
        public DharmaDbContext(DbContextOptions<DharmaDbContext> options) : base(options)
        {

            // Nothing      
        }

        public DbSet<Usuario>? Usuarios { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            modelBuilder.Entity<Usuario>(entity =>
            {
                entity.ToTable("Usuarios");
                entity.HasKey(e => e.IdUsuario);
            });
        }
    }
}
