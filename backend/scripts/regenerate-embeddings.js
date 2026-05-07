import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Project from '../models/Project.js';
import SymbolModel from '../models/Symbol.js';
import { generateEmbedding } from '../ai/embeddings.js';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/reqtracker';

async function regenerateEmbeddings() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    // Regenerar embeddings para requisitos
    console.log('Regenerating embeddings for requirements...');
    const projects = await Project.find({});
    let requirementCount = 0;

    for (const project of projects) {
      for (const requirement of project.requirements) {
        const textToEmbed = `${requirement.name} ${requirement.description} ${requirement.basis}`.trim();
        try {
          const embedding = await generateEmbedding(textToEmbed);
          requirement.embedding = embedding;
          requirementCount++;
        } catch (error) {
          console.warn(`Failed to generate embedding for requirement ${requirement._id}:`, error.message);
        }
      }
      await project.save();
    }
    console.log(`Regenerated embeddings for ${requirementCount} requirements`);

    // Regenerar embeddings para símbolos
    console.log('Regenerating embeddings for symbols...');
    const symbols = await SymbolModel.find({});
    let symbolCount = 0;

    for (const symbol of symbols) {
      const textToEmbed = `${symbol.name} ${symbol.type} ${symbol.notion} ${symbol.impact}`.trim();
      try {
        const embedding = await generateEmbedding(textToEmbed);
        symbol.embedding = embedding;
        await symbol.save();
        symbolCount++;
      } catch (error) {
        console.warn(`Failed to generate embedding for symbol ${symbol._id}:`, error.message);
      }
    }
    console.log(`Regenerated embeddings for ${symbolCount} symbols`);

    console.log('Embedding regeneration completed successfully');
  } catch (error) {
    console.error('Error regenerating embeddings:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

regenerateEmbeddings();