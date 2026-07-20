import mongoose from 'mongoose';
import { generateProjectRelations } from '../ai/graph-generation.service.js';
import Project from '../models/Project.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/reqtracker';

async function main() {
  try {
    console.log('Conectando a MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Conectado a MongoDB');

    const projectId = process.argv[2];

    if (!projectId) {
      console.log('\nUso: node generate-project-graph.js <projectId> [threshold]');
      console.log('\nEjemplo:');
      console.log('  node generate-project-graph.js 69fc5cffebceb17eec753a8e');
      console.log('  node generate-project-graph.js 69fc5cffebceb17eec753a8e 0.70\n');
      process.exit(1);
    }

    const threshold = parseFloat(process.argv[3]) || 0.65;

    console.log(`\nGenerando grafo para proyecto: ${projectId}`);
    console.log(`Umbral de similitud: ${threshold}\n`);

    const project = await Project.findById(projectId);
    if (!project) {
      console.error('Proyecto no encontrado');
      process.exit(1);
    }

    console.log(`Proyecto: ${project.name}`);

    const result = await generateProjectRelations({ projectId, threshold });

    console.log(`\n✓ Relaciones potenciales detectadas: ${result.potentialRelations}`);
    console.log(`✓ Relaciones creadas: ${result.createdRelations}`);

    if (result.relations.length > 0) {
      console.log('\nRelaciones creadas:');
      for (const rel of result.relations) {
        console.log(
          `  • [${rel.fromType}] → [${rel.toType}] (${rel.type}) - Confianza: ${(rel.similarity * 100).toFixed(2)}%`
        );
      }
    }

    await mongoose.connection.close();
    console.log('\n✓ Desconectado de MongoDB');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
