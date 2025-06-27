#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { YankiConnect } from "yanki-connect";
const client = new YankiConnect();

interface Card {
  cardId: number;
  question: string;
  answer: string;
  due: number;
}

/**
 * Create an MCP server with capabilities for resources (to get Anki cards),
 * and tools (to answer cards, create new cards and get cards).
 */
const server = new Server(
  {
    name: "anki-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      resources: {},
      tools: {},
    },
  }
);

/**
 * Handler for listing Anki cards as resources.
 * Cards are exposed as a resource with:
 * - An anki:// URI scheme plus a filter
 * - JSON MIME type
 * - All resources return a list of cards under different filters
 */
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: "anki://search/deckcurrent",
        mimeType: "application/json",
        name: "Current Deck",
        description: "Current Anki deck"
      },
      {
        uri: "anki://search/isdue",
        mimeType: "application/json",
        name: "Due cards",
        description: "Cards in review and learning waiting to be studied"
      },
      {
        uri: "anki://search/isnew",
        mimiType: "application/json",
        name: "New cards",
        description: "All unseen cards"
      }
    ]
  };
});

/**
 * Filters Anki cards based on selected resource
 */
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const url = new URL(request.params.uri);
  const query = url.pathname.split("/").pop();
  if (!query) {
    throw new Error("Invalid resource URI");
  }

  const cards = await findCardsAndOrder(query);

  return {
    contents: [{
      uri: request.params.uri,
      mimeType: "application/json",
      text: JSON.stringify(cards)
    }]
  };
});

// Returns a list of cards ordered by due date
async function findCardsAndOrder(query: string): Promise<Card[]> {
  const cardIds = await client.card.findCards({
    query: formatQuery(query)
  });
  const cards: Card[] = (await client.card.cardsInfo({ cards: cardIds })).map(card => ({
    cardId: card.cardId,
    question: cleanWithRegex(card.question),
    answer: cleanWithRegex(card.answer),
    due: card.due
  })).sort((a: Card, b: Card) => a.due - b.due);

  return cards;
}

// Formats the uri to be a proper query
function formatQuery(query: string): string {
  if (query.startsWith("deck")) {
    return `deck:${query.slice(4)}`;
  }
  if (query.startsWith("is")) {
    return `is:${query.slice(2)}`;
  }
  return query;
}

// Strip away formatting that isn't necessary
function cleanWithRegex(htmlString: string): string {
  return htmlString
    // Remove style tags and their content
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    // Replace divs with newlines
    .replace(/<div[^>]*>/g, '\n')
    // Remove all HTML tags
    .replace(/<[^>]+>/g, ' ')
    // Remove anki play tags
    .replace(/\[anki:play:[^\]]+\]/g, '')
    // Convert HTML entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    // Clean up whitespace but preserve newlines
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join('\n');
}

/**
 * Handler that lists available tools.
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "update_cards",
        description: "After the user answers cards you've quizzed them on, use this tool to mark them answered and update their ease",
        inputSchema: {
          type: "object",
          properties: {
            answers: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  cardId: {
                    type: "number",
                    description: "Id of the card to answer"
                  },
                  ease: {
                    type: "number",
                    description: "Ease of the card between 1 (Again) and 4 (Easy)"
                  }
                }
              }
            }
          },
        }
      },
      {
        name: "add_card",
        description: "Create a new flashcard in Anki for the user. Must use HTML formatting only. IMPORTANT FORMATTING RULES:\n1. Must use HTML tags for ALL formatting - NO markdown\n2. Use <br> for ALL line breaks\n3. For code blocks, use <pre> with inline CSS styling\n4. Example formatting:\n   - Line breaks: <br>\n   - Code: <pre style=\"background-color: transparent; padding: 10px; border-radius: 5px;\">\n   - Lists: <ol> and <li> tags\n   - Bold: <strong>\n   - Italic: <em>",
        inputSchema: {
          type: "object",
          properties: {
            front: {
              type: "string",
              description: "The front of the card. Must use HTML formatting only."
            },
            back: {
              type: "string",
              description: "The back of the card. Must use HTML formatting only."
            }
          },
          required: ["front", "back"]
        }
      },
      {
        name: "get_due_cards",
        description: "Returns a given number (num) of cards due for review.",
        inputSchema: {
          type: "object",
          properties: {
            num: {
              type: "number",
              description: "Number of due cards to get"
            }
          },
          required: ["num"]
        },
      },
      {
        name: "get_new_cards",
        description: "Returns a given number (num) of new and unseen cards.",
        inputSchema: {
          type: "object",
          properties: {
            num: {
              type: "number",
              description: "Number of new cards to get"
            }
          },
          required: ["num"]
        },
      },
      {
        name: "list_decks",
        description: "Get all deck names, optionally with IDs and basic statistics",
        inputSchema: {
          type: "object",
          properties: {
            includeIds: {
              type: "boolean",
              description: "Include deck IDs in the response"
            },
            includeStats: {
              type: "boolean",
              description: "Include basic statistics (new, learning, review counts)"
            }
          }
        }
      },
      {
        name: "get_deck_info",
        description: "Get detailed information about a specific deck including statistics",
        inputSchema: {
          type: "object",
          properties: {
            deckName: {
              type: "string",
              description: "Name of the deck to get information for"
            },
            includeStats: {
              type: "boolean",
              description: "Include detailed statistics for the deck"
            }
          },
          required: ["deckName"]
        }
      },
      {
        name: "get_deck_stats",
        description: "Get comprehensive statistics for one or more decks",
        inputSchema: {
          type: "object",
          properties: {
            deckNames: {
              type: "array",
              items: {
                type: "string"
              },
              description: "Array of deck names to get statistics for"
            },
            deckName: {
              type: "string",
              description: "Single deck name (alternative to deckNames array)"
            }
          }
        }
      },
      {
        name: "create_deck",
        description: "Create a new deck. Supports nested decks using '::' separator (e.g., 'Japanese::JLPT N5')",
        inputSchema: {
          type: "object",
          properties: {
            deckName: {
              type: "string",
              description: "Name of the deck to create. Use '::' for nested decks (e.g., 'Parent::Child')"
            }
          },
          required: ["deckName"]
        }
      },
      {
        name: "delete_deck",
        description: "Delete a deck and all its cards. Requires explicit confirmation for safety.",
        inputSchema: {
          type: "object",
          properties: {
            deckName: {
              type: "string",
              description: "Name of the deck to delete"
            },
            confirmDelete: {
              type: "boolean",
              description: "Must be set to true to confirm deletion (safety check)"
            }
          },
          required: ["deckName", "confirmDelete"]
        }
      },
      {
        name: "get_collection_stats",
        description: "Get comprehensive statistics about your entire Anki collection",
        inputSchema: {
          type: "object",
          properties: {
            includeHTML: {
              type: "boolean",
              description: "Include raw HTML stats report from Anki"
            }
          }
        }
      },
      {
        name: "get_cards_reviewed_today",
        description: "Get the number of cards reviewed today",
        inputSchema: {
          type: "object",
          properties: {}
        }
      },
      {
        name: "get_review_history",
        description: "Get historical review data over a specified period",
        inputSchema: {
          type: "object",
          properties: {
            days: {
              type: "number",
              description: "Number of days to look back (default: 30, max: 365)"
            }
          }
        }
      },
      {
        name: "get_card_reviews",
        description: "Get detailed review history for specific cards",
        inputSchema: {
          type: "object",
          properties: {
            cardIds: {
              type: "array",
              items: {
                type: "number"
              },
              description: "Array of card IDs to get review history for"
            }
          },
          required: ["cardIds"]
        }
      },
      {
        name: "get_deck_performance",
        description: "Get performance analytics for specific decks including success rates and timing",
        inputSchema: {
          type: "object",
          properties: {
            deckNames: {
              type: "array",
              items: {
                type: "string"
              },
              description: "Array of deck names to analyze"
            },
            deckName: {
              type: "string",
              description: "Single deck name (alternative to deckNames array)"
            },
            days: {
              type: "number",
              description: "Number of days to analyze (default: 30)"
            }
          }
        }
      },
      {
        name: "get_learning_stats",
        description: "Get learning progress analytics including graduation rates and retention",
        inputSchema: {
          type: "object",
          properties: {
            deckName: {
              type: "string",
              description: "Specific deck to analyze (optional, analyzes all decks if not provided)"
            },
            days: {
              type: "number",
              description: "Number of days to analyze (default: 30)"
            }
          }
        }
      },
      {
        name: "find_notes",
        description: "Search for notes using advanced filters and queries (e.g., 'deck:Japanese tag:grammar', 'front:*kanji*')",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search query using Anki search syntax (e.g., 'deck:Japanese tag:grammar', 'note:Basic created:7')"
            },
            limit: {
              type: "number",
              description: "Maximum number of results to return (default: 100, max: 1000)"
            }
          },
          required: ["query"]
        }
      },
      {
        name: "get_note_info_detailed",
        description: "Get comprehensive information about specific notes including all fields, tags, and associated cards",
        inputSchema: {
          type: "object",
          properties: {
            noteIds: {
              type: "array",
              items: {
                type: "number"
              },
              description: "Array of note IDs to get information for"
            },
            noteId: {
              type: "number",
              description: "Single note ID (alternative to noteIds array)"
            }
          }
        }
      },
      {
        name: "update_note_fields",
        description: "Update fields in existing notes. Preserves HTML formatting and card scheduling.",
        inputSchema: {
          type: "object",
          properties: {
            noteIds: {
              type: "array",
              items: {
                type: "number"
              },
              description: "Array of note IDs to update"
            },
            noteId: {
              type: "number",
              description: "Single note ID (alternative to noteIds array)"
            },
            fields: {
              type: "object",
              description: "Object with field names as keys and new values as values (e.g., {'Front': 'new front', 'Back': 'new back'})"
            }
          },
          required: ["fields"]
        }
      },
      {
        name: "delete_notes",
        description: "Delete notes and all associated cards. Requires explicit confirmation for safety.",
        inputSchema: {
          type: "object",
          properties: {
            noteIds: {
              type: "array",
              items: {
                type: "number"
              },
              description: "Array of note IDs to delete"
            },
            noteId: {
              type: "number",
              description: "Single note ID (alternative to noteIds array)"
            },
            confirmDelete: {
              type: "boolean",
              description: "Must be set to true to confirm deletion (safety check)"
            }
          },
          required: ["confirmDelete"]
        }
      },
      {
        name: "add_tags_to_notes",
        description: "Add tags to existing notes. Creates new tags automatically if they don't exist.",
        inputSchema: {
          type: "object",
          properties: {
            noteIds: {
              type: "array",
              items: {
                type: "number"
              },
              description: "Array of note IDs to add tags to"
            },
            noteId: {
              type: "number",
              description: "Single note ID (alternative to noteIds array)"
            },
            tags: {
              type: "array",
              items: {
                type: "string"
              },
              description: "Array of tags to add (e.g., ['grammar', 'difficult', 'review'])"
            }
          },
          required: ["tags"]
        }
      },
      {
        name: "remove_tags_from_notes",
        description: "Remove specific tags from notes. Does not delete the tags entirely, just removes them from specified notes.",
        inputSchema: {
          type: "object",
          properties: {
            noteIds: {
              type: "array",
              items: {
                type: "number"
              },
              description: "Array of note IDs to remove tags from"
            },
            noteId: {
              type: "number",
              description: "Single note ID (alternative to noteIds array)"
            },
            tags: {
              type: "array",
              items: {
                type: "string"
              },
              description: "Array of tags to remove (e.g., ['old', 'deprecated'])"
            }
          },
          required: ["tags"]
        }
      },
      {
        name: "get_all_tags",
        description: "Get all tags in the collection with optional usage statistics",
        inputSchema: {
          type: "object",
          properties: {
            includeUsage: {
              type: "boolean",
              description: "Include count of how many notes use each tag"
            }
          }
        }
      },
      {
        name: "duplicate_note",
        description: "Create a copy of an existing note, optionally modifying fields and changing deck",
        inputSchema: {
          type: "object",
          properties: {
            noteId: {
              type: "number",
              description: "ID of the note to duplicate"
            },
            targetDeck: {
              type: "string",
              description: "Deck to create the duplicate in (optional, uses original deck if not specified)"
            },
            fieldUpdates: {
              type: "object",
              description: "Fields to modify in the duplicate (optional, e.g., {'Front': 'modified front'})"
            },
            additionalTags: {
              type: "array",
              items: {
                type: "string"
              },
              description: "Additional tags to add to the duplicate (optional)"
            }
          },
          required: ["noteId"]
        }
      },
      {
        name: "find_cards_advanced",
        description: "Search for cards using advanced filters including ease factors, intervals, and scheduling (e.g., 'deck:Japanese prop:ease<2.0', 'is:due prop:ivl>30')",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Advanced search query using Anki search syntax with properties (e.g., 'deck:Japanese prop:ease<2.0', 'is:review prop:ivl>30')"
            },
            limit: {
              type: "number",
              description: "Maximum number of results to return (default: 100, max: 1000)"
            }
          },
          required: ["query"]
        }
      },
      {
        name: "get_card_info_detailed",
        description: "Get comprehensive information about specific cards including ease factors, intervals, lapses, and scheduling details",
        inputSchema: {
          type: "object",
          properties: {
            cardIds: {
              type: "array",
              items: {
                type: "number"
              },
              description: "Array of card IDs to get detailed information for"
            },
            cardId: {
              type: "number",
              description: "Single card ID (alternative to cardIds array)"
            }
          }
        }
      },
      {
        name: "suspend_cards",
        description: "Suspend or unsuspend cards to control their review scheduling. Suspended cards won't appear in reviews.",
        inputSchema: {
          type: "object",
          properties: {
            cardIds: {
              type: "array",
              items: {
                type: "number"
              },
              description: "Array of card IDs to suspend or unsuspend"
            },
            cardId: {
              type: "number",
              description: "Single card ID (alternative to cardIds array)"
            },
            suspend: {
              type: "boolean",
              description: "true to suspend cards, false to unsuspend cards"
            }
          },
          required: ["suspend"]
        }
      },
      {
        name: "set_card_due_date",
        description: "Reschedule cards to specific due dates. Useful for managing review timing and catching up on overdue cards.",
        inputSchema: {
          type: "object",
          properties: {
            cardIds: {
              type: "array",
              items: {
                type: "number"
              },
              description: "Array of card IDs to reschedule"
            },
            cardId: {
              type: "number",
              description: "Single card ID (alternative to cardIds array)"
            },
            days: {
              type: "string",
              description: "Due date specification: '0' = today, '1' = tomorrow, '3-7' = random 3-7 days, or specific number of days"
            }
          },
          required: ["days"]
        }
      },
      {
        name: "forget_cards",
        description: "Reset card progress to 'new' status, removing all review history. Requires explicit confirmation for safety.",
        inputSchema: {
          type: "object",
          properties: {
            cardIds: {
              type: "array",
              items: {
                type: "number"
              },
              description: "Array of card IDs to reset"
            },
            cardId: {
              type: "number",
              description: "Single card ID (alternative to cardIds array)"
            },
            confirmReset: {
              type: "boolean",
              description: "Must be set to true to confirm resetting card progress (safety check)"
            }
          },
          required: ["confirmReset"]
        }
      },
      {
        name: "set_card_ease_factors",
        description: "Adjust ease factors for cards to make them easier or harder. Higher ease = longer intervals.",
        inputSchema: {
          type: "object",
          properties: {
            cardIds: {
              type: "array",
              items: {
                type: "number"
              },
              description: "Array of card IDs to adjust"
            },
            cardId: {
              type: "number",
              description: "Single card ID (alternative to cardIds array)"
            },
            easeFactors: {
              type: "array",
              items: {
                type: "number"
              },
              description: "Array of ease factors (one per card, typically 1300-4000, default ~2500)"
            },
            easeFactor: {
              type: "number",
              description: "Single ease factor to apply to all cards (alternative to easeFactors array)"
            }
          }
        }
      },
      {
        name: "get_card_intervals",
        description: "Get interval information for cards including current intervals and historical progression",
        inputSchema: {
          type: "object",
          properties: {
            cardIds: {
              type: "array",
              items: {
                type: "number"
              },
              description: "Array of card IDs to analyze"
            },
            cardId: {
              type: "number",
              description: "Single card ID (alternative to cardIds array)"
            },
            includeHistory: {
              type: "boolean",
              description: "Include complete interval history for each card (default: false)"
            }
          }
        }
      },
      {
        name: "list_models",
        description: "Get all note types/models in the collection with optional detailed information",
        inputSchema: {
          type: "object",
          properties: {
            includeDetails: {
              type: "boolean",
              description: "Include detailed model information including fields and templates (default: false)"
            }
          }
        }
      },
      {
        name: "get_model_info",
        description: "Get comprehensive information about specific models including fields, templates, and styling",
        inputSchema: {
          type: "object",
          properties: {
            modelNames: {
              type: "array",
              items: {
                type: "string"
              },
              description: "Array of model names to get information for"
            },
            modelName: {
              type: "string",
              description: "Single model name (alternative to modelNames array)"
            }
          }
        }
      },
      {
        name: "get_model_fields",
        description: "Get field definitions and properties for specific models",
        inputSchema: {
          type: "object",
          properties: {
            modelNames: {
              type: "array",
              items: {
                type: "string"
              },
              description: "Array of model names to get field information for"
            },
            modelName: {
              type: "string",
              description: "Single model name (alternative to modelNames array)"
            },
            includeProperties: {
              type: "boolean",
              description: "Include detailed field properties like fonts, sizes, descriptions (default: false)"
            }
          }
        }
      },
      {
        name: "create_model",
        description: "Create a new note type with custom fields and templates. Supports both basic and cloze deletion models.",
        inputSchema: {
          type: "object",
          properties: {
            modelName: {
              type: "string",
              description: "Name for the new model (must be unique)"
            },
            fields: {
              type: "array",
              items: {
                type: "string"
              },
              description: "Array of field names for the model (e.g., ['Front', 'Back', 'Extra'])"
            },
            templates: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: {
                    type: "string",
                    description: "Template name (e.g., 'Card 1')"
                  },
                  front: {
                    type: "string",
                    description: "Front template HTML (e.g., '{{Front}}')"
                  },
                  back: {
                    type: "string",
                    description: "Back template HTML (e.g., '{{FrontSide}}<hr>{{Back}}')"
                  }
                },
                required: ["name", "front", "back"]
              },
              description: "Array of card templates"
            },
            css: {
              type: "string",
              description: "CSS styling for the model (optional, uses default if not provided)"
            },
            isCloze: {
              type: "boolean",
              description: "Create as cloze deletion model (default: false)"
            }
          },
          required: ["modelName", "fields", "templates"]
        }
      },
      {
        name: "update_model_templates",
        description: "Update card templates and styling for existing models",
        inputSchema: {
          type: "object",
          properties: {
            modelName: {
              type: "string",
              description: "Name of the model to update"
            },
            templates: {
              type: "object",
              description: "Templates to update, with template names as keys and template objects as values"
            },
            css: {
              type: "string",
              description: "New CSS styling for the model (optional)"
            }
          },
          required: ["modelName"]
        }
      },
      {
        name: "get_profiles",
        description: "Get all available Anki profiles on the system",
        inputSchema: {
          type: "object",
          properties: {}
        }
      },
      {
        name: "get_active_profile",
        description: "Get information about the currently active Anki profile",
        inputSchema: {
          type: "object",
          properties: {}
        }
      },
      {
        name: "switch_profile",
        description: "Switch to a different Anki profile. This will change the active profile and reload the collection.",
        inputSchema: {
          type: "object",
          properties: {
            profileName: {
              type: "string",
              description: "Name of the profile to switch to"
            }
          },
          required: ["profileName"]
        }
      },
      {
        name: "sync_collection",
        description: "Sync the collection with AnkiWeb. Requires AnkiWeb account setup in Anki.",
        inputSchema: {
          type: "object",
          properties: {
            forceSync: {
              type: "boolean",
              description: "Force sync even if no changes detected (default: false)"
            }
          }
        }
      },
      {
        name: "export_deck",
        description: "Export a deck to an .apkg file for backup or sharing",
        inputSchema: {
          type: "object",
          properties: {
            deckName: {
              type: "string",
              description: "Name of the deck to export"
            },
            filePath: {
              type: "string",
              description: "Path where to save the .apkg file (should end with .apkg)"
            },
            includeScheduling: {
              type: "boolean",
              description: "Include scheduling information in export (default: true)"
            }
          },
          required: ["deckName", "filePath"]
        }
      },
      {
        name: "reload_collection",
        description: "Reload the collection to refresh data after external changes",
        inputSchema: {
          type: "object",
          properties: {}
        }
      }
    ]
  };
});

/**
 * Handler for all MCP tools including card management, deck management, statistics, and note management.
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (!args) {
    throw new Error(`No arguments provided for tool: ${name}`);
  }

  switch (name) {
    case "update_cards": {
      const answers = args.answers as { cardId: number; ease: number }[];
      const result = await client.card.answerCards({ answers: answers });

      const successfulCards = answers
        .filter((_, index) => result[index])
        .map(card => card.cardId);
      const failedCards = answers.filter((_, index) => !result[index]);

      if (failedCards.length > 0) {
        const failedCardIds = failedCards.map(card => card.cardId);
        throw new Error(`Failed to update cards with IDs: ${failedCardIds.join(', ')}`);
      }

      return {
        content: [{
          type: "text",
          text: `Updated cards ${successfulCards.join(", ")}`
        }]
      };
    }

    case "add_card": {
      const front = String(args.front);
      const back = String(args.back);

      const note = {
        note: {
          deckName: 'Default',
          fields: {
            Back: back,
            Front: front,
          },
          modelName: 'Basic',
        },
      };

      const noteId = await client.note.addNote(note);
      const cardId = (await client.card.findCards({ query: `nid:${noteId}` }))[0];

      return {
        content: [{
          type: "text",
          text: `Created card with id ${cardId}`
        }]
      };
    }

    case "get_due_cards": {
      const num = Number(args.num);

      const cards = await findCardsAndOrder("is:due");

      return {
        content: [{
          type: "text",
          text: JSON.stringify(cards.slice(0, num))
        }]
      };
    }

    case "get_new_cards": {
      const num = Number(args.num);

      const cards = await findCardsAndOrder("is:new");

      return {
        content: [{
          type: "text",
          text: JSON.stringify(cards.slice(0, num))
        }]
      };
    }

    case "list_decks": {
      try {
        const includeIds = Boolean(args.includeIds);
        const includeStats = Boolean(args.includeStats);

        if (includeStats) {
          // Get deck names first, then get stats for all decks
          const deckNames = await client.deck.deckNames();
          const deckStats = await client.deck.getDeckStats({ decks: deckNames });
          
          const result = Object.values(deckStats).map(stat => ({
            name: stat.name,
            deck_id: stat.deck_id,
            new_count: stat.new_count,
            learn_count: stat.learn_count,
            review_count: stat.review_count,
            total_in_deck: stat.total_in_deck
          }));

          return {
            content: [{
              type: "text",
              text: JSON.stringify(result)
            }]
          };
        } else if (includeIds) {
          const deckNamesAndIds = await client.deck.deckNamesAndIds();
          return {
            content: [{
              type: "text",
              text: JSON.stringify(deckNamesAndIds)
            }]
          };
        } else {
          const deckNames = await client.deck.deckNames();
          return {
            content: [{
              type: "text",
              text: JSON.stringify(deckNames)
            }]
          };
        }
      } catch (error) {
        throw new Error(`Failed to list decks. Make sure Anki is running and AnkiConnect is installed. Error: ${error}`);
      }
    }

    case "get_deck_info": {
      try {
        const deckName = String(args.deckName);
        const includeStats = Boolean(args.includeStats);

        // First check if deck exists by getting all deck names
        const allDecks = await client.deck.deckNamesAndIds();
        if (!(deckName in allDecks)) {
          throw new Error(`Deck '${deckName}' not found. Available decks: ${Object.keys(allDecks).join(', ')}`);
        }

        const result: any = {
          name: deckName,
          deck_id: allDecks[deckName]
        };

        if (includeStats) {
          const deckStats = await client.deck.getDeckStats({ decks: [deckName] });
          const stats = Object.values(deckStats)[0];
          if (stats) {
            result.new_count = stats.new_count;
            result.learn_count = stats.learn_count;
            result.review_count = stats.review_count;
            result.total_in_deck = stats.total_in_deck;
          }
        }

        return {
          content: [{
            type: "text",
            text: JSON.stringify(result)
          }]
        };
      } catch (error) {
        if (error instanceof Error && error.message.includes('not found')) {
          throw error;
        }
        throw new Error(`Failed to get deck info. Make sure Anki is running and the deck name is correct. Error: ${error}`);
      }
    }

    case "get_deck_stats": {
      try {
        let deckNames: string[];
        
        if (args.deckNames && Array.isArray(args.deckNames)) {
          deckNames = args.deckNames.map(String);
        } else if (args.deckName) {
          deckNames = [String(args.deckName)];
        } else {
          throw new Error("Either 'deckNames' array or 'deckName' string must be provided");
        }

        const deckStats = await client.deck.getDeckStats({ decks: deckNames });
        
        // Convert to a more readable format
        const result = Object.values(deckStats).map(stat => ({
          name: stat.name,
          deck_id: stat.deck_id,
          new_count: stat.new_count,
          learn_count: stat.learn_count,
          review_count: stat.review_count,
          total_in_deck: stat.total_in_deck
        }));

        return {
          content: [{
            type: "text",
            text: JSON.stringify(result)
          }]
        };
      } catch (error) {
        throw new Error(`Failed to get deck statistics. Make sure Anki is running and deck names are correct. Error: ${error}`);
      }
    }

    case "create_deck": {
      try {
        const deckName = String(args.deckName);
        
        if (!deckName || deckName.trim() === '') {
          throw new Error("Deck name cannot be empty");
        }

        // Validate deck name format for nested decks
        if (deckName.includes('::')) {
          const parts = deckName.split('::');
          for (const part of parts) {
            if (part.trim() === '') {
              throw new Error("Invalid deck name format. Each part separated by '::' must be non-empty. Example: 'Parent::Child'");
            }
          }
        }

        const deckId = await client.deck.createDeck({ deck: deckName });

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              deck_name: deckName,
              deck_id: deckId,
              message: `Successfully created deck '${deckName}'`
            })
          }]
        };
      } catch (error) {
        throw new Error(`Failed to create deck. Make sure Anki is running and the deck name is valid. Use '::' for nested decks (e.g., 'Parent::Child'). Error: ${error}`);
      }
    }

    case "delete_deck": {
      try {
        const deckName = String(args.deckName);
        const confirmDelete = Boolean(args.confirmDelete);

        if (!confirmDelete) {
          throw new Error("Deletion requires confirmDelete: true to prevent accidental deletions. This action cannot be undone!");
        }

        // Check if deck exists first
        const allDecks = await client.deck.deckNamesAndIds();
        if (!(deckName in allDecks)) {
          throw new Error(`Deck '${deckName}' not found. Available decks: ${Object.keys(allDecks).join(', ')}`);
        }

        // Get deck stats to show what will be deleted
        const deckStats = await client.deck.getDeckStats({ decks: [deckName] });
        const stats = Object.values(deckStats)[0];
        const totalCards = stats ? stats.total_in_deck : 0;

        // Delete the deck (cardsToo must be true)
        await client.deck.deleteDecks({ decks: [deckName], cardsToo: true });

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              deck_name: deckName,
              cards_deleted: totalCards,
              message: `Successfully deleted deck '${deckName}' and ${totalCards} cards`
            })
          }]
        };
      } catch (error) {
        if (error instanceof Error && (error.message.includes('not found') || error.message.includes('confirmDelete'))) {
          throw error;
        }
        throw new Error(`Failed to delete deck. Make sure Anki is running and the deck exists. Error: ${error}`);
      }
    }

    case "get_collection_stats": {
      try {
        const includeHTML = Boolean(args.includeHTML);

        // Get basic collection statistics
        const deckNames = await client.deck.deckNames();
        const allDeckStats = await client.deck.getDeckStats({ decks: deckNames });
        
        // Calculate totals across all decks
        const totalStats = Object.values(allDeckStats).reduce((acc, deck) => ({
          total_decks: acc.total_decks + 1,
          total_cards: acc.total_cards + deck.total_in_deck,
          new_cards: acc.new_cards + deck.new_count,
          learning_cards: acc.learning_cards + deck.learn_count,
          review_cards: acc.review_cards + deck.review_count
        }), { total_decks: 0, total_cards: 0, new_cards: 0, learning_cards: 0, review_cards: 0 });

        // Get cards reviewed today
        const reviewedToday = await client.statistic.getNumCardsReviewedToday();

        const result: any = {
          collection_summary: {
            total_decks: totalStats.total_decks,
            total_cards: totalStats.total_cards,
            new_cards: totalStats.new_cards,
            learning_cards: totalStats.learning_cards,
            review_cards: totalStats.review_cards,
            cards_reviewed_today: reviewedToday
          },
          deck_breakdown: Object.values(allDeckStats).map(deck => ({
            name: deck.name,
            total_cards: deck.total_in_deck,
            new_count: deck.new_count,
            learn_count: deck.learn_count,
            review_count: deck.review_count
          }))
        };

        if (includeHTML) {
          const htmlStats = await client.statistic.getCollectionStatsHTML({ wholeCollection: true });
          result.html_report = htmlStats;
        }

        return {
          content: [{
            type: "text",
            text: JSON.stringify(result)
          }]
        };
      } catch (error) {
        throw new Error(`Failed to get collection statistics. Make sure Anki is running. Error: ${error}`);
      }
    }

    case "get_cards_reviewed_today": {
      try {
        const reviewedToday = await client.statistic.getNumCardsReviewedToday();

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              cards_reviewed_today: reviewedToday,
              date: new Date().toISOString().split('T')[0]
            })
          }]
        };
      } catch (error) {
        throw new Error(`Failed to get cards reviewed today. Make sure Anki is running. Error: ${error}`);
      }
    }

    case "get_review_history": {
      try {
        const days = Math.min(Number(args.days) || 30, 365); // Default 30 days, max 365

        const reviewHistory = await client.statistic.getNumCardsReviewedByDay();
        
        // Limit to requested number of days and format the data
        const limitedHistory = reviewHistory.slice(0, days).map(([date, count]) => ({
          date,
          cards_reviewed: count
        }));

        // Calculate some summary statistics
        const totalReviews = limitedHistory.reduce((sum, day) => sum + day.cards_reviewed, 0);
        const averagePerDay = totalReviews / limitedHistory.length;
        const maxDay = limitedHistory.reduce((max, day) => 
          day.cards_reviewed > max.cards_reviewed ? day : max, limitedHistory[0] || { date: '', cards_reviewed: 0 });

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              period_days: days,
              total_reviews: totalReviews,
              average_per_day: Math.round(averagePerDay * 100) / 100,
              max_day: maxDay,
              daily_history: limitedHistory
            })
          }]
        };
      } catch (error) {
        throw new Error(`Failed to get review history. Make sure Anki is running. Error: ${error}`);
      }
    }

    case "get_card_reviews": {
      try {
        const cardIds = args.cardIds as number[];
        
        if (!Array.isArray(cardIds) || cardIds.length === 0) {
          throw new Error("cardIds must be a non-empty array of card IDs");
        }

        // Convert to strings as required by the API
        const cardIdStrings = cardIds.map(id => String(id));
        const reviewsData = await client.statistic.getReviewsOfCards({ cards: cardIdStrings });

        // Format the response to be more readable
        const result = Object.entries(reviewsData).map(([cardId, reviews]) => ({
          card_id: Number(cardId),
          review_count: reviews.length,
          reviews: reviews.map(review => ({
            review_time: new Date(review.id).toISOString(),
            ease: review.ease,
            interval_days: review.ivl,
            previous_interval_days: review.lastIvl,
            ease_factor: review.factor,
            time_taken_ms: review.time,
            review_type: review.type // 0=learning, 1=review, 2=relearn, 3=filtered
          }))
        }));

        return {
          content: [{
            type: "text",
            text: JSON.stringify(result)
          }]
        };
      } catch (error) {
        throw new Error(`Failed to get card reviews. Make sure Anki is running and card IDs are valid. Error: ${error}`);
      }
    }

    case "get_deck_performance": {
      try {
        let deckNames: string[];
        const days = Number(args.days) || 30;
        
        if (args.deckNames && Array.isArray(args.deckNames)) {
          deckNames = args.deckNames.map(String);
        } else if (args.deckName) {
          deckNames = [String(args.deckName)];
        } else {
          // If no specific decks provided, analyze all decks
          deckNames = await client.deck.deckNames();
        }

        // Get current deck statistics
        const deckStats = await client.deck.getDeckStats({ decks: deckNames });
        
        // Get review history for analysis
        const reviewHistory = await client.statistic.getNumCardsReviewedByDay();
        const recentHistory = reviewHistory.slice(0, days);
        const totalRecentReviews = recentHistory.reduce((sum, [, count]) => sum + count, 0);

        const result = Object.values(deckStats).map(deck => {
          const totalCards = deck.total_in_deck;
          const dueCards = deck.new_count + deck.learn_count + deck.review_count;
          const completedCards = totalCards - dueCards;
          const completionRate = totalCards > 0 ? (completedCards / totalCards) * 100 : 0;

          return {
            deck_name: deck.name,
            deck_id: deck.deck_id,
            total_cards: totalCards,
            completed_cards: completedCards,
            due_cards: dueCards,
            completion_rate_percent: Math.round(completionRate * 100) / 100,
            card_distribution: {
              new: deck.new_count,
              learning: deck.learn_count,
              review: deck.review_count
            },
            analysis_period_days: days
          };
        });

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              analysis_period_days: days,
              total_recent_reviews: totalRecentReviews,
              deck_performance: result
            })
          }]
        };
      } catch (error) {
        throw new Error(`Failed to get deck performance. Make sure Anki is running and deck names are correct. Error: ${error}`);
      }
    }

    case "get_learning_stats": {
      try {
        const days = Number(args.days) || 30;
        const deckName = args.deckName ? String(args.deckName) : null;

        // Get deck statistics
        let deckNames: string[];
        if (deckName) {
          deckNames = [deckName];
        } else {
          deckNames = await client.deck.deckNames();
        }

        const deckStats = await client.deck.getDeckStats({ decks: deckNames });
        
        // Get review history for trend analysis
        const reviewHistory = await client.statistic.getNumCardsReviewedByDay();
        const recentHistory = reviewHistory.slice(0, days);
        
        // Calculate learning statistics
        const totalStats = Object.values(deckStats).reduce((acc, deck) => ({
          total_cards: acc.total_cards + deck.total_in_deck,
          new_cards: acc.new_cards + deck.new_count,
          learning_cards: acc.learning_cards + deck.learn_count,
          review_cards: acc.review_cards + deck.review_count
        }), { total_cards: 0, new_cards: 0, learning_cards: 0, review_cards: 0 });

        const matureCards = totalStats.total_cards - totalStats.new_cards - totalStats.learning_cards;
        const maturityRate = totalStats.total_cards > 0 ? (matureCards / totalStats.total_cards) * 100 : 0;
        
        // Calculate recent activity
        const totalRecentReviews = recentHistory.reduce((sum, [, count]) => sum + count, 0);
        const averageReviewsPerDay = totalRecentReviews / Math.min(days, recentHistory.length);

        const result = {
          analysis_period_days: days,
          scope: deckName || "All decks",
          learning_progress: {
            total_cards: totalStats.total_cards,
            mature_cards: matureCards,
            learning_cards: totalStats.learning_cards,
            new_cards: totalStats.new_cards,
            maturity_rate_percent: Math.round(maturityRate * 100) / 100
          },
          recent_activity: {
            total_reviews: totalRecentReviews,
            average_reviews_per_day: Math.round(averageReviewsPerDay * 100) / 100,
            most_active_day: recentHistory.reduce((max, [date, count]) => 
              count > max.count ? { date, count } : max, { date: '', count: 0 })
          },
          deck_breakdown: deckName ? undefined : Object.values(deckStats).map(deck => ({
            name: deck.name,
            total_cards: deck.total_in_deck,
            new_count: deck.new_count,
            learn_count: deck.learn_count,
            review_count: deck.review_count
          }))
        };

        return {
          content: [{
            type: "text",
            text: JSON.stringify(result)
          }]
        };
      } catch (error) {
        throw new Error(`Failed to get learning statistics. Make sure Anki is running and deck name is correct (if provided). Error: ${error}`);
      }
    }

    case "find_notes": {
      try {
        const query = String(args.query);
        const limit = Math.min(Number(args.limit) || 100, 1000); // Default 100, max 1000

        if (!query || query.trim() === '') {
          throw new Error("Query cannot be empty. Use Anki search syntax like 'deck:Japanese tag:grammar' or 'front:*kanji*'");
        }

        const noteIds = await client.note.findNotes({ query });
        
        // Limit results for performance
        const limitedNoteIds = noteIds.slice(0, limit);

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              query,
              total_found: noteIds.length,
              returned_count: limitedNoteIds.length,
              note_ids: limitedNoteIds,
              truncated: noteIds.length > limit
            })
          }]
        };
      } catch (error) {
        throw new Error(`Failed to find notes. Make sure Anki is running and query syntax is correct. Examples: 'deck:Japanese', 'tag:grammar', 'front:*word*'. Error: ${error}`);
      }
    }

    case "get_note_info_detailed": {
      try {
        let noteIds: number[];
        
        if (args.noteIds && Array.isArray(args.noteIds)) {
          noteIds = args.noteIds.map(Number);
        } else if (args.noteId) {
          noteIds = [Number(args.noteId)];
        } else {
          throw new Error("Either 'noteIds' array or 'noteId' must be provided");
        }

        if (noteIds.length === 0) {
          throw new Error("At least one note ID must be provided");
        }

        const notesInfo = await client.note.notesInfo({ notes: noteIds });

        const result = notesInfo.map(note => ({
          note_id: note.noteId,
          model_name: note.modelName,
          tags: note.tags,
          fields: note.fields,
          cards: note.cards,
          modification_time: note.mod ? new Date(note.mod * 1000).toISOString() : null,
          profile: note.profile || null
        }));

        return {
          content: [{
            type: "text",
            text: JSON.stringify(result)
          }]
        };
      } catch (error) {
        throw new Error(`Failed to get note information. Make sure Anki is running and note IDs are valid. Error: ${error}`);
      }
    }

    case "update_note_fields": {
      try {
        let noteIds: number[];
        
        if (args.noteIds && Array.isArray(args.noteIds)) {
          noteIds = args.noteIds.map(Number);
        } else if (args.noteId) {
          noteIds = [Number(args.noteId)];
        } else {
          throw new Error("Either 'noteIds' array or 'noteId' must be provided");
        }

        const fields = args.fields as Record<string, string>;
        if (!fields || Object.keys(fields).length === 0) {
          throw new Error("Fields object must be provided with at least one field to update");
        }

        const results = [];
        for (const noteId of noteIds) {
          try {
            await client.note.updateNoteFields({
              note: {
                id: noteId,
                fields: fields
              }
            });
            results.push({ note_id: noteId, success: true });
          } catch (error) {
            results.push({ note_id: noteId, success: false, error: String(error) });
          }
        }

        const successCount = results.filter(r => r.success).length;
        const failureCount = results.length - successCount;

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              total_notes: noteIds.length,
              successful_updates: successCount,
              failed_updates: failureCount,
              updated_fields: Object.keys(fields),
              results: results
            })
          }]
        };
      } catch (error) {
        throw new Error(`Failed to update note fields. Make sure Anki is running, note IDs are valid, and field names exist in the note type. Error: ${error}`);
      }
    }

    case "delete_notes": {
      try {
        let noteIds: number[];
        const confirmDelete = Boolean(args.confirmDelete);

        if (!confirmDelete) {
          throw new Error("Deletion requires confirmDelete: true to prevent accidental deletions. This action cannot be undone!");
        }
        
        if (args.noteIds && Array.isArray(args.noteIds)) {
          noteIds = args.noteIds.map(Number);
        } else if (args.noteId) {
          noteIds = [Number(args.noteId)];
        } else {
          throw new Error("Either 'noteIds' array or 'noteId' must be provided");
        }

        if (noteIds.length === 0) {
          throw new Error("At least one note ID must be provided");
        }

        // Get note info before deletion to show what will be deleted
        const notesInfo = await client.note.notesInfo({ notes: noteIds });
        const totalCards = notesInfo.reduce((sum, note) => sum + note.cards.length, 0);

        // Delete the notes
        await client.note.deleteNotes({ notes: noteIds });

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              deleted_notes: noteIds.length,
              deleted_cards: totalCards,
              note_ids: noteIds,
              message: `Successfully deleted ${noteIds.length} notes and ${totalCards} associated cards`
            })
          }]
        };
      } catch (error) {
        if (error instanceof Error && error.message.includes('confirmDelete')) {
          throw error;
        }
        throw new Error(`Failed to delete notes. Make sure Anki is running and note IDs are valid. Error: ${error}`);
      }
    }

    case "add_tags_to_notes": {
      try {
        let noteIds: number[];
        
        if (args.noteIds && Array.isArray(args.noteIds)) {
          noteIds = args.noteIds.map(Number);
        } else if (args.noteId) {
          noteIds = [Number(args.noteId)];
        } else {
          throw new Error("Either 'noteIds' array or 'noteId' must be provided");
        }

        const tags = args.tags as string[];
        if (!Array.isArray(tags) || tags.length === 0) {
          throw new Error("Tags array must be provided with at least one tag");
        }

        // Join tags into a space-separated string as required by the API
        const tagsString = tags.join(' ');

        await client.note.addTags({ notes: noteIds, tags: tagsString });

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              notes_updated: noteIds.length,
              tags_added: tags,
              note_ids: noteIds,
              message: `Successfully added tags [${tags.join(', ')}] to ${noteIds.length} notes`
            })
          }]
        };
      } catch (error) {
        throw new Error(`Failed to add tags to notes. Make sure Anki is running and note IDs are valid. Error: ${error}`);
      }
    }

    case "remove_tags_from_notes": {
      try {
        let noteIds: number[];
        
        if (args.noteIds && Array.isArray(args.noteIds)) {
          noteIds = args.noteIds.map(Number);
        } else if (args.noteId) {
          noteIds = [Number(args.noteId)];
        } else {
          throw new Error("Either 'noteIds' array or 'noteId' must be provided");
        }

        const tags = args.tags as string[];
        if (!Array.isArray(tags) || tags.length === 0) {
          throw new Error("Tags array must be provided with at least one tag");
        }

        // Join tags into a space-separated string as required by the API
        const tagsString = tags.join(' ');

        await client.note.removeTags({ notes: noteIds, tags: tagsString });

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              notes_updated: noteIds.length,
              tags_removed: tags,
              note_ids: noteIds,
              message: `Successfully removed tags [${tags.join(', ')}] from ${noteIds.length} notes`
            })
          }]
        };
      } catch (error) {
        throw new Error(`Failed to remove tags from notes. Make sure Anki is running and note IDs are valid. Error: ${error}`);
      }
    }

    case "get_all_tags": {
      try {
        const includeUsage = Boolean(args.includeUsage);

        const allTags = await client.note.getTags();

        if (includeUsage) {
          // For each tag, count how many notes use it
          const tagUsage = [];
          for (const tag of allTags) {
            try {
              const noteIds = await client.note.findNotes({ query: `tag:"${tag}"` });
              tagUsage.push({
                tag: tag,
                note_count: noteIds.length
              });
            } catch (error) {
              // If there's an error with a specific tag, include it with 0 count
              tagUsage.push({
                tag: tag,
                note_count: 0,
                error: String(error)
              });
            }
          }

          // Sort by usage count (descending)
          tagUsage.sort((a, b) => b.note_count - a.note_count);

          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                total_tags: allTags.length,
                tags_with_usage: tagUsage
              })
            }]
          };
        } else {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                total_tags: allTags.length,
                tags: allTags.sort()
              })
            }]
          };
        }
      } catch (error) {
        throw new Error(`Failed to get tags. Make sure Anki is running. Error: ${error}`);
      }
    }

    case "duplicate_note": {
      try {
        const noteId = Number(args.noteId);
        const targetDeck = args.targetDeck ? String(args.targetDeck) : null;
        const fieldUpdates = args.fieldUpdates as Record<string, string> || {};
        const additionalTags = args.additionalTags as string[] || [];

        // Get the original note information
        const originalNotes = await client.note.notesInfo({ notes: [noteId] });
        if (originalNotes.length === 0) {
          throw new Error(`Note with ID ${noteId} not found`);
        }

        const originalNote = originalNotes[0];

        // Prepare the new note data
        const newFields: Record<string, string> = {};
        for (const [fieldName, fieldData] of Object.entries(originalNote.fields)) {
          // Use updated value if provided, otherwise use original
          newFields[fieldName] = fieldUpdates[fieldName] || fieldData.value;
        }

        // Combine original tags with additional tags
        const allTags = [...originalNote.tags, ...additionalTags];

        // Create the duplicate note
        const newNote = {
          note: {
            deckName: targetDeck || 'Default', // Use target deck or Default
            modelName: originalNote.modelName,
            fields: newFields,
            tags: allTags
          }
        };

        const newNoteId = await client.note.addNote(newNote);

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              original_note_id: noteId,
              new_note_id: newNoteId,
              target_deck: targetDeck || 'Default',
              fields_updated: Object.keys(fieldUpdates),
              additional_tags: additionalTags,
              message: `Successfully duplicated note ${noteId} to new note ${newNoteId}`
            })
          }]
        };
      } catch (error) {
        throw new Error(`Failed to duplicate note. Make sure Anki is running, note ID is valid, and target deck exists (if specified). Error: ${error}`);
      }
    }

    case "find_cards_advanced": {
      try {
        const query = String(args.query);
        const limit = Math.min(Number(args.limit) || 100, 1000); // Default 100, max 1000

        if (!query || query.trim() === '') {
          throw new Error("Query cannot be empty. Use advanced Anki search syntax like 'deck:Japanese prop:ease<2.0' or 'is:due prop:ivl>30'");
        }

        const cardIds = await client.card.findCards({ query });
        
        // Limit results for performance
        const limitedCardIds = cardIds.slice(0, limit);

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              query,
              total_found: cardIds.length,
              returned_count: limitedCardIds.length,
              card_ids: limitedCardIds,
              truncated: cardIds.length > limit
            })
          }]
        };
      } catch (error) {
        throw new Error(`Failed to find cards. Make sure Anki is running and query syntax is correct. Examples: 'deck:Japanese prop:ease<2.0', 'is:review prop:ivl>30', 'is:suspended'. Error: ${error}`);
      }
    }

    case "get_card_info_detailed": {
      try {
        let cardIds: number[];
        
        if (args.cardIds && Array.isArray(args.cardIds)) {
          cardIds = args.cardIds.map(Number);
        } else if (args.cardId) {
          cardIds = [Number(args.cardId)];
        } else {
          throw new Error("Either 'cardIds' array or 'cardId' must be provided");
        }

        if (cardIds.length === 0) {
          throw new Error("At least one card ID must be provided");
        }

        const cardsInfo = await client.card.cardsInfo({ cards: cardIds });

        const result = cardsInfo.map(card => ({
          card_id: card.cardId,
          note_id: card.note,
          deck_name: card.deckName,
          model_name: card.modelName,
          question: cleanWithRegex(card.question),
          answer: cleanWithRegex(card.answer),
          fields: card.fields,
          ease_factor: (card as any).factor || null,
          interval_days: card.interval,
          due_date: card.due,
          card_type: card.type, // 0=new, 1=learning, 2=review
          queue: card.queue, // -1=suspended, 0=new, 1=learning, 2=review, 3=day learning
          lapses: card.lapses,
          reviews: card.reps,
          remaining_steps: card.left,
          modification_time: card.mod ? new Date(card.mod * 1000).toISOString() : null,
          css: card.css
        }));

        return {
          content: [{
            type: "text",
            text: JSON.stringify(result)
          }]
        };
      } catch (error) {
        throw new Error(`Failed to get detailed card information. Make sure Anki is running and card IDs are valid. Error: ${error}`);
      }
    }

    case "suspend_cards": {
      try {
        let cardIds: number[];
        const suspend = Boolean(args.suspend);
        
        if (args.cardIds && Array.isArray(args.cardIds)) {
          cardIds = args.cardIds.map(Number);
        } else if (args.cardId) {
          cardIds = [Number(args.cardId)];
        } else {
          throw new Error("Either 'cardIds' array or 'cardId' must be provided");
        }

        if (cardIds.length === 0) {
          throw new Error("At least one card ID must be provided");
        }

        let result;
        if (suspend) {
          result = await client.card.suspend({ cards: cardIds });
        } else {
          result = await client.card.unsuspend({ cards: cardIds });
        }

        const action = suspend ? 'suspended' : 'unsuspended';
        const successCount = Array.isArray(result) ? result.filter(Boolean).length : (result ? cardIds.length : 0);

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              action: action,
              cards_affected: successCount,
              total_cards: cardIds.length,
              card_ids: cardIds,
              message: `Successfully ${action} ${successCount} out of ${cardIds.length} cards`
            })
          }]
        };
      } catch (error) {
        throw new Error(`Failed to suspend/unsuspend cards. Make sure Anki is running and card IDs are valid. Error: ${error}`);
      }
    }

    case "set_card_due_date": {
      try {
        let cardIds: number[];
        const days = String(args.days);
        
        if (args.cardIds && Array.isArray(args.cardIds)) {
          cardIds = args.cardIds.map(Number);
        } else if (args.cardId) {
          cardIds = [Number(args.cardId)];
        } else {
          throw new Error("Either 'cardIds' array or 'cardId' must be provided");
        }

        if (cardIds.length === 0) {
          throw new Error("At least one card ID must be provided");
        }

        const result = await client.card.setDueDate({ cards: cardIds, days: days });

        const successCount = Array.isArray(result) ? result.filter(Boolean).length : (result ? cardIds.length : 0);

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              cards_rescheduled: successCount,
              total_cards: cardIds.length,
              due_date_spec: days,
              card_ids: cardIds,
              message: `Successfully rescheduled ${successCount} out of ${cardIds.length} cards to be due in ${days} days`
            })
          }]
        };
      } catch (error) {
        throw new Error(`Failed to set card due dates. Make sure Anki is running, card IDs are valid, and days format is correct (e.g., '0', '1', '3-7'). Error: ${error}`);
      }
    }

    case "forget_cards": {
      try {
        let cardIds: number[];
        const confirmReset = Boolean(args.confirmReset);

        if (!confirmReset) {
          throw new Error("Reset requires confirmReset: true to prevent accidental progress loss. This action cannot be undone!");
        }
        
        if (args.cardIds && Array.isArray(args.cardIds)) {
          cardIds = args.cardIds.map(Number);
        } else if (args.cardId) {
          cardIds = [Number(args.cardId)];
        } else {
          throw new Error("Either 'cardIds' array or 'cardId' must be provided");
        }

        if (cardIds.length === 0) {
          throw new Error("At least one card ID must be provided");
        }

        // Get card info before resetting to show what will be affected
        const cardsInfo = await client.card.cardsInfo({ cards: cardIds });
        const reviewCounts = cardsInfo.map(card => card.reps || 0);
        const totalReviews = reviewCounts.reduce((sum, count) => sum + count, 0);

        await client.card.forgetCards({ cards: cardIds });

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              cards_reset: cardIds.length,
              total_reviews_lost: totalReviews,
              card_ids: cardIds,
              message: `Successfully reset ${cardIds.length} cards to 'new' status, removing ${totalReviews} total reviews`
            })
          }]
        };
      } catch (error) {
        if (error instanceof Error && error.message.includes('confirmReset')) {
          throw error;
        }
        throw new Error(`Failed to forget cards. Make sure Anki is running and card IDs are valid. Error: ${error}`);
      }
    }

    case "set_card_ease_factors": {
      try {
        let cardIds: number[];
        let easeFactors: number[];
        
        if (args.cardIds && Array.isArray(args.cardIds)) {
          cardIds = args.cardIds.map(Number);
        } else if (args.cardId) {
          cardIds = [Number(args.cardId)];
        } else {
          throw new Error("Either 'cardIds' array or 'cardId' must be provided");
        }

        if (cardIds.length === 0) {
          throw new Error("At least one card ID must be provided");
        }

        // Handle ease factors
        if (args.easeFactors && Array.isArray(args.easeFactors)) {
          easeFactors = args.easeFactors.map(Number);
          if (easeFactors.length !== cardIds.length) {
            throw new Error("Number of ease factors must match number of card IDs");
          }
        } else if (args.easeFactor) {
          const singleEase = Number(args.easeFactor);
          easeFactors = new Array(cardIds.length).fill(singleEase);
        } else {
          throw new Error("Either 'easeFactors' array or 'easeFactor' must be provided");
        }

        // Validate ease factors (typical range 1300-4000)
        for (const ease of easeFactors) {
          if (ease < 1300 || ease > 4000) {
            throw new Error(`Ease factor ${ease} is outside typical range (1300-4000). Use with caution.`);
          }
        }

        const result = await client.card.setEaseFactors({ cards: cardIds, easeFactors: easeFactors });

        const successCount = Array.isArray(result) ? result.filter(Boolean).length : (result ? cardIds.length : 0);

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              cards_updated: successCount,
              total_cards: cardIds.length,
              ease_factors: easeFactors,
              card_ids: cardIds,
              message: `Successfully updated ease factors for ${successCount} out of ${cardIds.length} cards`
            })
          }]
        };
      } catch (error) {
        throw new Error(`Failed to set card ease factors. Make sure Anki is running, card IDs are valid, and ease factors are in reasonable range (1300-4000). Error: ${error}`);
      }
    }

    case "get_card_intervals": {
      try {
        let cardIds: number[];
        const includeHistory = Boolean(args.includeHistory);
        
        if (args.cardIds && Array.isArray(args.cardIds)) {
          cardIds = args.cardIds.map(Number);
        } else if (args.cardId) {
          cardIds = [Number(args.cardId)];
        } else {
          throw new Error("Either 'cardIds' array or 'cardId' must be provided");
        }

        if (cardIds.length === 0) {
          throw new Error("At least one card ID must be provided");
        }

        const intervals = await client.card.getIntervals({ cards: cardIds, complete: includeHistory });

        let result;
        if (includeHistory) {
          // intervals is a 2D array with complete history
          const intervalsArray = intervals as number[][];
          result = cardIds.map((cardId, index) => ({
            card_id: cardId,
            current_interval: intervalsArray[index] ? intervalsArray[index][intervalsArray[index].length - 1] : null,
            interval_history: intervalsArray[index] || [],
            total_intervals: intervalsArray[index] ? intervalsArray[index].length : 0
          }));
        } else {
          // intervals is a 1D array with just current intervals
          const intervalsArray = intervals as number[];
          result = cardIds.map((cardId, index) => ({
            card_id: cardId,
            current_interval: intervalsArray[index] || null,
            interval_days: intervalsArray[index] > 0 ? intervalsArray[index] : null,
            interval_seconds: intervalsArray[index] < 0 ? Math.abs(intervalsArray[index]) : null
          }));
        }

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              include_history: includeHistory,
              card_intervals: result
            })
          }]
        };
      } catch (error) {
        throw new Error(`Failed to get card intervals. Make sure Anki is running and card IDs are valid. Error: ${error}`);
      }
    }

    case "list_models": {
      try {
        const includeDetails = Boolean(args.includeDetails);

        if (includeDetails) {
          // Get model names and IDs, then get detailed info
          const modelNamesAndIds = await client.model.modelNamesAndIds();
          const modelIds = Object.values(modelNamesAndIds);
          const detailedModels = await client.model.findModelsById({ modelIds });

          const result = detailedModels.map(model => ({
            id: model.id,
            name: model.name,
            type: model.type, // 0=standard, 1=cloze
            field_count: model.flds.length,
            template_count: model.tmpls.length,
            fields: model.flds.map(field => field.name),
            templates: model.tmpls.map(template => template.name),
            css_length: model.css.length,
            modification_time: new Date(model.mod * 1000).toISOString()
          }));

          return {
            content: [{
              type: "text",
              text: JSON.stringify(result)
            }]
          };
        } else {
          // Just get model names and IDs
          const modelNamesAndIds = await client.model.modelNamesAndIds();
          return {
            content: [{
              type: "text",
              text: JSON.stringify(modelNamesAndIds)
            }]
          };
        }
      } catch (error) {
        throw new Error(`Failed to list models. Make sure Anki is running. Error: ${error}`);
      }
    }

    case "get_model_info": {
      try {
        let modelNames: string[];
        
        if (args.modelNames && Array.isArray(args.modelNames)) {
          modelNames = args.modelNames.map(String);
        } else if (args.modelName) {
          modelNames = [String(args.modelName)];
        } else {
          throw new Error("Either 'modelNames' array or 'modelName' must be provided");
        }

        if (modelNames.length === 0) {
          throw new Error("At least one model name must be provided");
        }

        const detailedModels = await client.model.findModelsByName({ modelNames });

        const result = detailedModels.map(model => ({
          id: model.id,
          name: model.name,
          type: model.type, // 0=standard, 1=cloze
          modification_time: new Date(model.mod * 1000).toISOString(),
          fields: model.flds.map(field => ({
            name: field.name,
            order: field.ord,
            sticky: field.sticky,
            rtl: field.rtl,
            font: field.font,
            size: field.size,
            description: field.description || "",
            collapsed: field.collapsed,
            exclude_from_search: field.excludeFromSearch
          })),
          templates: model.tmpls.map(template => ({
            name: template.name,
            order: template.ord,
            question_format: template.qfmt,
            answer_format: template.afmt,
            browser_question_format: template.bqfmt || "",
            browser_answer_format: template.bafmt || ""
          })),
          css: model.css,
          latex_pre: model.latexPre,
          latex_post: model.latexPost,
          sort_field: model.sortf
        }));

        return {
          content: [{
            type: "text",
            text: JSON.stringify(result)
          }]
        };
      } catch (error) {
        throw new Error(`Failed to get model information. Make sure Anki is running and model names are correct. Error: ${error}`);
      }
    }

    case "get_model_fields": {
      try {
        let modelNames: string[];
        const includeProperties = Boolean(args.includeProperties);
        
        if (args.modelNames && Array.isArray(args.modelNames)) {
          modelNames = args.modelNames.map(String);
        } else if (args.modelName) {
          modelNames = [String(args.modelName)];
        } else {
          throw new Error("Either 'modelNames' array or 'modelName' must be provided");
        }

        if (modelNames.length === 0) {
          throw new Error("At least one model name must be provided");
        }

        const result = [];
        for (const modelName of modelNames) {
          if (includeProperties) {
            // Get detailed field information
            const fieldFonts = await client.model.modelFieldFonts({ modelName });
            const fieldNames = await client.model.modelFieldNames({ modelName });

            const fields = fieldNames.map((name, index) => ({
              name: name,
              order: index,
              font: fieldFonts[name]?.font || "Arial",
              size: fieldFonts[name]?.size || 20,
              description: "" // Field descriptions require individual API calls per field
            }));

            result.push({
              model_name: modelName,
              field_count: fieldNames.length,
              fields: fields
            });
          } else {
            // Just get field names
            const fieldNames = await client.model.modelFieldNames({ modelName });
            result.push({
              model_name: modelName,
              field_count: fieldNames.length,
              field_names: fieldNames
            });
          }
        }

        return {
          content: [{
            type: "text",
            text: JSON.stringify(result)
          }]
        };
      } catch (error) {
        throw new Error(`Failed to get model fields. Make sure Anki is running and model names are correct. Error: ${error}`);
      }
    }

    case "create_model": {
      try {
        const modelName = String(args.modelName);
        const fields = args.fields as string[];
        const templates = args.templates as Array<{name: string, front: string, back: string}>;
        const css = args.css ? String(args.css) : undefined;
        const isCloze = Boolean(args.isCloze);

        if (!modelName || modelName.trim() === '') {
          throw new Error("Model name cannot be empty");
        }

        if (!Array.isArray(fields) || fields.length === 0) {
          throw new Error("Fields array must be provided with at least one field");
        }

        if (!Array.isArray(templates) || templates.length === 0) {
          throw new Error("Templates array must be provided with at least one template");
        }

        // Validate template structure
        for (const template of templates) {
          if (!template.name || !template.front || !template.back) {
            throw new Error("Each template must have 'name', 'front', and 'back' properties");
          }
        }

        // Check if model already exists
        try {
          const existingModels = await client.model.modelNames();
          if (existingModels.includes(modelName)) {
            throw new Error(`Model '${modelName}' already exists. Choose a different name.`);
          }
        } catch (error) {
          // Continue if we can't check existing models
        }

        // Format templates for the API
        const formattedTemplates = templates.map(template => ({
          Name: template.name,
          Front: template.front,
          Back: template.back
        }));

        const modelData = {
          modelName: modelName,
          inOrderFields: fields,
          cardTemplates: formattedTemplates,
          css: css,
          isCloze: isCloze
        };

        const createdModel = await client.model.createModel(modelData);

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              model_name: modelName,
              model_id: createdModel.id,
              field_count: fields.length,
              template_count: templates.length,
              is_cloze: isCloze,
              fields: fields,
              templates: templates.map(t => t.name),
              message: `Successfully created model '${modelName}' with ${fields.length} fields and ${templates.length} templates`
            })
          }]
        };
      } catch (error) {
        throw new Error(`Failed to create model. Make sure Anki is running, model name is unique, and template syntax is valid. Error: ${error}`);
      }
    }

    case "update_model_templates": {
      try {
        const modelName = String(args.modelName);
        const templates = args.templates as Record<string, any>;
        const css = args.css ? String(args.css) : undefined;

        if (!modelName || modelName.trim() === '') {
          throw new Error("Model name cannot be empty");
        }

        // Check if model exists
        try {
          const existingModels = await client.model.modelNames();
          if (!existingModels.includes(modelName)) {
            throw new Error(`Model '${modelName}' not found. Available models: ${existingModels.join(', ')}`);
          }
        } catch (error) {
          if (error instanceof Error && error.message.includes('not found')) {
            throw error;
          }
        }

        const updateData: any = {
          model: {
            name: modelName
          }
        };

        // Update templates if provided
        if (templates && Object.keys(templates).length > 0) {
          updateData.model.templates = {};
          for (const [templateName, templateData] of Object.entries(templates)) {
            updateData.model.templates[templateName] = {
              Front: templateData.front || templateData.Front,
              Back: templateData.back || templateData.Back
            };
          }
          await client.model.updateModelTemplates(updateData);
        }

        // Update CSS if provided
        if (css) {
          const cssUpdateData = {
            model: {
              name: modelName,
              css: css
            }
          };
          await client.model.updateModelStyling(cssUpdateData);
        }

        const updatedItems = [];
        if (templates && Object.keys(templates).length > 0) {
          updatedItems.push(`${Object.keys(templates).length} templates`);
        }
        if (css) {
          updatedItems.push('CSS styling');
        }

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              model_name: modelName,
              updated_templates: templates ? Object.keys(templates) : [],
              updated_css: !!css,
              message: `Successfully updated ${updatedItems.join(' and ')} for model '${modelName}'`
            })
          }]
        };
      } catch (error) {
        if (error instanceof Error && error.message.includes('not found')) {
          throw error;
        }
        throw new Error(`Failed to update model templates. Make sure Anki is running, model exists, and template syntax is valid. Error: ${error}`);
      }
    }

    case "get_profiles": {
      try {
        const profiles = await client.miscellaneous.getProfiles();

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              profiles: profiles,
              profile_count: profiles.length
            })
          }]
        };
      } catch (error) {
        throw new Error(`Failed to get profiles. Make sure Anki is running. Error: ${error}`);
      }
    }

    case "get_active_profile": {
      try {
        const activeProfile = await client.miscellaneous.getActiveProfile();

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              active_profile: activeProfile,
              timestamp: new Date().toISOString()
            })
          }]
        };
      } catch (error) {
        throw new Error(`Failed to get active profile. Make sure Anki is running. Error: ${error}`);
      }
    }

    case "switch_profile": {
      try {
        const profileName = String(args.profileName);

        if (!profileName || profileName.trim() === '') {
          throw new Error("Profile name cannot be empty");
        }

        // Check if profile exists
        const availableProfiles = await client.miscellaneous.getProfiles();
        if (!availableProfiles.includes(profileName)) {
          throw new Error(`Profile '${profileName}' not found. Available profiles: ${availableProfiles.join(', ')}`);
        }

        // Get current profile before switching
        const currentProfile = await client.miscellaneous.getActiveProfile();

        // Switch to the new profile
        await client.miscellaneous.loadProfile({ name: profileName });

        // Verify the switch was successful
        const newActiveProfile = await client.miscellaneous.getActiveProfile();

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              previous_profile: currentProfile,
              new_profile: newActiveProfile,
              profile_switched: newActiveProfile === profileName,
              message: `Successfully switched from '${currentProfile}' to '${newActiveProfile}'`
            })
          }]
        };
      } catch (error) {
        if (error instanceof Error && error.message.includes('not found')) {
          throw error;
        }
        throw new Error(`Failed to switch profile. Make sure Anki is running and profile name is correct. Error: ${error}`);
      }
    }

    case "sync_collection": {
      try {
        const forceSync = Boolean(args.forceSync);

        // Perform the sync
        const syncResult = await client.miscellaneous.sync();

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              sync_result: syncResult,
              force_sync: forceSync,
              timestamp: new Date().toISOString(),
              message: "Collection sync completed successfully"
            })
          }]
        };
      } catch (error) {
        throw new Error(`Failed to sync collection. Make sure Anki is running, you're logged into AnkiWeb, and have an internet connection. Error: ${error}`);
      }
    }

    case "export_deck": {
      try {
        const deckName = String(args.deckName);
        const filePath = String(args.filePath);
        const includeScheduling = args.includeScheduling !== false; // Default to true

        if (!deckName || deckName.trim() === '') {
          throw new Error("Deck name cannot be empty");
        }

        if (!filePath || filePath.trim() === '') {
          throw new Error("File path cannot be empty");
        }

        // Validate file extension
        if (!filePath.toLowerCase().endsWith('.apkg')) {
          throw new Error("File path must end with .apkg extension");
        }

        // Check if deck exists
        const allDecks = await client.deck.deckNamesAndIds();
        if (!(deckName in allDecks)) {
          throw new Error(`Deck '${deckName}' not found. Available decks: ${Object.keys(allDecks).join(', ')}`);
        }

        // Export the deck
        const exportResult = await client.miscellaneous.exportPackage({
          deck: deckName,
          path: filePath,
          includeSched: includeScheduling
        });

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              deck_name: deckName,
              file_path: filePath,
              include_scheduling: includeScheduling,
              export_result: exportResult,
              message: `Successfully exported deck '${deckName}' to '${filePath}'`
            })
          }]
        };
      } catch (error) {
        if (error instanceof Error && error.message.includes('not found')) {
          throw error;
        }
        throw new Error(`Failed to export deck. Make sure Anki is running, deck exists, and file path is valid. Error: ${error}`);
      }
    }

    case "reload_collection": {
      try {
        await client.miscellaneous.reloadCollection();

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              timestamp: new Date().toISOString(),
              message: "Collection reloaded successfully"
            })
          }]
        };
      } catch (error) {
        throw new Error(`Failed to reload collection. Make sure Anki is running. Error: ${error}`);
      }
    }

    default:
      throw new Error("Unknown tool");
  }
});

/**
 * Start the server using stdio transport.
 * This allows the server to communicate via standard input/output streams.
 */
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
