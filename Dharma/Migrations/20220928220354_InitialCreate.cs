using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Dharma.Migrations
{
    public partial class InitialCreate : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "UsuariosDharma",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Nombre = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    password = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    telefono = table.Column<int>(type: "int", nullable: true),
                    direccion = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UsuariosDharma", x => x.Id);
                });

            migrationBuilder.InsertData(
                table: "UsuariosDharma",
                columns: new[] { "Id", "Nombre", "direccion", "password", "telefono" },
                values: new object[] { 1, "Jose Miguel", "C/ La Braille 16", "josemi89", 636041446 });

            migrationBuilder.InsertData(
                table: "UsuariosDharma",
                columns: new[] { "Id", "Nombre", "direccion", "password", "telefono" },
                values: new object[] { 2, "Bartolo", "C/ La Lazarillo 29", "bartolo78", 987986797 });
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "UsuariosDharma");
        }
    }
}
