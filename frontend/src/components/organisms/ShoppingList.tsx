import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Checkbox,
  TextField,
  Button,
  Stack,
  Chip,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Alert,
  InputAdornment,
  Tooltip,
  Divider,
  Grid,
  Card,
  CardContent,
  LinearProgress,
  Autocomplete,
  Popover,
  SpeedDial,
  SpeedDialAction,
  SpeedDialIcon,
  ListItemButton,
  ListItemAvatar,
  Avatar,
  AvatarGroup,
  Slider,
  ToggleButton,
  ToggleButtonGroup,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  FormGroup,
  FormControlLabel,
  Switch,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Share as ShareIcon,
  MoreVert as MoreIcon,
  LocalOffer as PriceIcon,
  Sort as SortIcon,
  Category as CategoryIcon,
  ArrowUpward,
  ArrowDownward,
  CheckBox as CheckBoxIcon,
  Lightbulb as SuggestionIcon,
  ShoppingBasket as BasketIcon,
  Savings as SavingsIcon,
  RestaurantMenu as RecipeIcon,
  ContentCopy as TemplateIcon,
  Save as SaveTemplateIcon,
  Event as CalendarIcon,
  Bookmark as BookmarkIcon,
  Group as ServingsIcon,
  Scale as ScaleIcon,
  Restaurant as ServingIcon,
  LocalDining as NutritionIcon,
  ExpandMore as ExpandMoreIcon,
  Spa as OrganicIcon,
  Warning as AllergenIcon,
  Analytics as AnalyticsIcon,
  Restaurant as RestaurantIcon,
} from '@mui/icons-material';
import { ShoppingList as ShoppingListType, ShoppingListItem, shoppingListService } from '../../services/shopping-list.service';
import { useAuth } from '../../contexts/AuthContext';
import { ObjectId } from 'mongodb';

interface ShoppingListProps {
  listId: string;
  onPriceCompare?: () => void;
}

interface ItemSuggestion {
  name: string;
  category?: string;
  confidence: number;
  reason: string;
}

interface FrequentlyBoughtTogether {
  items: string[];
  frequency: number;
  totalSavings: number;
}

interface ListTemplate {
  id: string;
  name: string;
  description: string;
  items: Array<{
    name: string;
    category?: string;
    amount: number;
    unit: string;
  }>;
  usageCount: number;
}

interface MealPlan {
  id: string;
  name: string;
  date: Date;
  recipes: Array<{
    id: string;
    name: string;
    image?: string;
    servings: number;
  }>;
}

interface NutritionalInfo {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  sugar?: number;
  servingSize: {
    amount: number;
    unit: string;
  };
}

interface ItemDetails extends ShoppingListItem {
  nutritionalInfo?: NutritionalInfo;
  organic?: boolean;
  allergens?: string[];
  alternatives?: Array<{
    name: string;
    price: number;
    organic: boolean;
  }>;
}

interface ListAnalytics {
  totalItems: number;
  checkedItems: number;
  totalPrice: number;
  averageItemPrice: number;
  mostExpensiveItems: Array<{
    name: string;
    price: number;
  }>;
  categoriesBreakdown: Array<{
    category: string;
    count: number;
    totalPrice: number;
  }>;
  dietaryBreakdown: {
    vegetarian: number;
    vegan: number;
    glutenFree: number;
    dairyFree: number;
    nutFree: number;
  };
  priceHistory: Array<{
    date: Date;
    totalPrice: number;
  }>;
  savingsOpportunities: Array<{
    item: string;
    potentialSavings: number;
    alternativeStore: string;
  }>;
}

interface DietaryPreferences {
  vegetarian: boolean;
  vegan: boolean;
  glutenFree: boolean;
  dairyFree: boolean;
  nutFree: boolean;
  allergies: string[];
  excludedIngredients: string[];
}

interface ExtendedShoppingListItem extends ShoppingListItem {
  tags?: string[];
  price?: number;
}

interface RawListStats {
  totalItems: number;
  checkedItems: number;
  totalPrice: number;
  items?: Array<{
    name: string;
    tags?: string[];
    price?: number;
    category?: string;
  }>;
  priceHistory: Array<{
    date: Date;
    totalPrice: number;
  }>;
  mostFrequentItems: Array<{
    name: string;
    count: number;
  }>;
}

interface ListStatsResponse {
  totalItems: number;
  checkedItems: number;
  totalPrice: number;
  items: ExtendedShoppingListItem[];
  priceHistory: Array<{
    date: Date;
    totalPrice: number;
  }>;
  mostFrequentItems: Array<{
    name: string;
    count: number;
  }>;
}

const commonAllergies = [
  'Peanuts',
  'Tree Nuts',
  'Milk',
  'Eggs',
  'Fish',
  'Shellfish',
  'Soy',
  'Wheat',
  'Sesame',
];

export const ShoppingList: React.FC<ShoppingListProps> = ({
  listId,
  onPriceCompare,
}) => {
  const { user } = useAuth();
  const [list, setList] = useState<ShoppingListType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newItem, setNewItem] = useState('');
  const [editingItem, setEditingItem] = useState<ShoppingListItem | null>(null);
  const [editingItemDetails, setEditingItemDetails] = useState<ItemDetails | null>(null);
  const [servingCount, setServingCount] = useState(1);
  const [selectedUnit, setSelectedUnit] = useState<string>('');
  const [showNutritionalInfo, setShowNutritionalInfo] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [collaboratorEmail, setCollaboratorEmail] = useState('');
  const [collaboratorRole, setCollaboratorRole] = useState<'editor' | 'viewer'>('editor');
  const [sortBy, setSortBy] = useState<'name' | 'category' | 'date' | 'checked'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [stats, setStats] = useState<{
    totalItems: number;
    checkedItems: number;
    totalPrice: number;
    priceHistory: Array<{
      date: Date;
      totalPrice: number;
    }>;
    mostFrequentItems: Array<{
      name: string;
      count: number;
    }>;
  } | null>(null);
  const [suggestions, setSuggestions] = useState<ItemSuggestion[]>([]);
  const [frequentlyBoughtTogether, setFrequentlyBoughtTogether] = useState<FrequentlyBoughtTogether[]>([]);
  const [suggestionAnchor, setSuggestionAnchor] = useState<null | HTMLElement>(null);
  const [templates, setTemplates] = useState<ListTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<ListTemplate | null>(null);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [saveTemplateDialogOpen, setSaveTemplateDialogOpen] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateDescription, setNewTemplateDescription] = useState('');
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([]);
  const [mealPlanDialogOpen, setMealPlanDialogOpen] = useState(false);
  const [selectedMealPlan, setSelectedMealPlan] = useState<MealPlan | null>(null);
  const [analytics, setAnalytics] = useState<ListAnalytics | null>(null);
  const [dietaryPreferences, setDietaryPreferences] = useState<DietaryPreferences>({
    vegetarian: false,
    vegan: false,
    glutenFree: false,
    dairyFree: false,
    nutFree: false,
    allergies: [],
    excludedIngredients: [],
  });
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showDietaryWarnings, setShowDietaryWarnings] = useState(true);
  const [dietaryDialogOpen, setDietaryDialogOpen] = useState(false);

  useEffect(() => {
    fetchList();
    const unsubscribe = shoppingListService.subscribeToList(listId, handleListUpdate);
    return () => unsubscribe();
  }, [listId]);

  useEffect(() => {
    if (list) {
      fetchStats();
      fetchSuggestions();
      fetchFrequentlyBoughtTogether();
    }
  }, [list]);

  useEffect(() => {
    fetchTemplates();
    fetchMealPlans();
  }, []);

  useEffect(() => {
    if (list) {
      checkDietaryCompliance();
    }
  }, [list, dietaryPreferences]);

  const fetchList = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await shoppingListService.getList(listId);
      setList(data);
    } catch (err) {
      setError('Failed to load shopping list');
      console.error('Error fetching list:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const listStats = await shoppingListService.getListStats(listId);
      setStats(listStats);
    } catch (err) {
      console.error('Error fetching list stats:', err);
    }
  };

  const fetchSuggestions = async () => {
    try {
      // Simulate API call - replace with actual backend call
      const mockSuggestions: ItemSuggestion[] = [
        {
          name: "Butter",
          category: "Dairy",
          confidence: 0.85,
          reason: "Often bought with Milk",
        },
        {
          name: "Sugar",
          category: "Baking",
          confidence: 0.75,
          reason: "Based on your shopping history",
        },
        {
          name: "Coffee Filters",
          category: "Coffee & Tea",
          confidence: 0.95,
          reason: "Running low based on purchase patterns",
        },
      ];
      setSuggestions(mockSuggestions);
    } catch (err) {
      console.error('Error fetching suggestions:', err);
    }
  };

  const fetchFrequentlyBoughtTogether = async () => {
    try {
      // Simulate API call - replace with actual backend call
      const mockFrequentItems: FrequentlyBoughtTogether[] = [
        {
          items: ["Milk", "Bread", "Eggs"],
          frequency: 0.8,
          totalSavings: 2.50,
        },
        {
          items: ["Pasta", "Tomato Sauce", "Ground Beef"],
          frequency: 0.7,
          totalSavings: 3.25,
        },
      ];
      setFrequentlyBoughtTogether(mockFrequentItems);
    } catch (err) {
      console.error('Error fetching frequently bought items:', err);
    }
  };

  const fetchTemplates = async () => {
    try {
      // Simulate API call - replace with actual backend call
      const mockTemplates: ListTemplate[] = [
        {
          id: '1',
          name: 'Weekly Essentials',
          description: 'Basic items needed every week',
          items: [
            { name: 'Milk', category: 'Dairy', amount: 1, unit: 'gallon' },
            { name: 'Bread', category: 'Bakery', amount: 2, unit: 'loaf' },
            { name: 'Eggs', category: 'Dairy', amount: 12, unit: 'piece' },
          ],
          usageCount: 156,
        },
        {
          id: '2',
          name: 'Party Supplies',
          description: 'Items for hosting parties',
          items: [
            { name: 'Chips', category: 'Snacks', amount: 3, unit: 'bag' },
            { name: 'Soda', category: 'Beverages', amount: 2, unit: 'liter' },
            { name: 'Paper Plates', category: 'Supplies', amount: 1, unit: 'pack' },
          ],
          usageCount: 45,
        },
      ];
      setTemplates(mockTemplates);
    } catch (err) {
      console.error('Error fetching templates:', err);
    }
  };

  const fetchMealPlans = async () => {
    try {
      // Simulate API call - replace with actual backend call
      const mockMealPlans: MealPlan[] = [
        {
          id: '1',
          name: 'This Week\'s Dinners',
          date: new Date(),
          recipes: [
            { id: '1', name: 'Spaghetti Bolognese', servings: 4, image: '/mock-recipe-1.jpg' },
            { id: '2', name: 'Chicken Stir Fry', servings: 3, image: '/mock-recipe-2.jpg' },
            { id: '3', name: 'Fish Tacos', servings: 4, image: '/mock-recipe-3.jpg' },
          ],
        },
        {
          id: '2',
          name: 'Weekend Brunch',
          date: new Date(Date.now() + 86400000 * 5),
          recipes: [
            { id: '4', name: 'Pancakes', servings: 6, image: '/mock-recipe-4.jpg' },
            { id: '5', name: 'Eggs Benedict', servings: 4, image: '/mock-recipe-5.jpg' },
          ],
        },
      ];
      setMealPlans(mockMealPlans);
    } catch (err) {
      console.error('Error fetching meal plans:', err);
    }
  };

  const handleListUpdate = (update: any) => {
    if (update.type === 'item_update') {
      setList(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          items: prev.items.map(item =>
            item._id.toString() === update.itemId ? { ...item, ...update.data } : item
          ),
        };
      });
    } else if (update.type === 'list_update') {
      setList(prev => prev ? { ...prev, ...update.data } : prev);
    }
  };

  const handleAddItem = async (itemName: string) => {
    if (!itemName.trim() || !list) return;

    try {
      const item = await shoppingListService.addItem(listId, {
        name: itemName.trim(),
        amount: 1,
        unit: 'piece',
      });
      setList({
        ...list,
        items: [...list.items, item],
      });
      setNewItem('');
    } catch (err) {
      console.error('Error adding item:', err);
    }
  };

  const handleToggleItem = async (item: ShoppingListItem) => {
    try {
      await shoppingListService.updateItem(listId, item._id.toString(), {
        checked: !item.checked,
      });
    } catch (err) {
      console.error('Error updating item:', err);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    try {
      await shoppingListService.deleteItem(listId, itemId);
      setList(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          items: prev.items.filter(item => item._id.toString() !== itemId),
        };
      });
    } catch (err) {
      console.error('Error deleting item:', err);
    }
  };

  const handleUpdateItem = async () => {
    if (!editingItem) return;

    try {
      await shoppingListService.updateItem(listId, editingItem._id.toString(), editingItem);
      setList(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          items: prev.items.map(item =>
            item._id === editingItem._id ? editingItem : item
          ),
        };
      });
      setEditingItem(null);
    } catch (err) {
      console.error('Error updating item:', err);
    }
  };

  const handleAddCollaborator = async () => {
    if (!collaboratorEmail.trim()) return;

    try {
      await shoppingListService.addCollaborator(listId, collaboratorEmail, collaboratorRole);
      setShareDialogOpen(false);
      setCollaboratorEmail('');
    } catch (err) {
      console.error('Error adding collaborator:', err);
    }
  };

  const isOwner = list?.createdBy._id.toString() === user?.id;
  const canEdit = isOwner || list?.collaborators.some(c => 
    c.userId.toString() === user?.id && c.role === 'editor'
  );

  const getSortedAndFilteredItems = () => {
    if (!list) return [];

    return list.items
      .filter(item => categoryFilter === 'all' || item.category === categoryFilter)
      .sort((a, b) => {
        const multiplier = sortOrder === 'asc' ? 1 : -1;
        switch (sortBy) {
          case 'name':
            return a.name.localeCompare(b.name) * multiplier;
          case 'category':
            return (a.category || '').localeCompare(b.category || '') * multiplier;
          case 'checked':
            return (Number(a.checked) - Number(b.checked)) * multiplier;
          case 'date':
            return ((new Date(a.createdAt || 0)).getTime() - (new Date(b.createdAt || 0)).getTime()) * multiplier;
          default:
            return 0;
        }
      });
  };

  const getCategories = () => {
    if (!list) return new Set<string>();
    return new Set(list.items.map(item => item.category).filter(Boolean));
  };

  const handleAddSuggestion = async (suggestion: ItemSuggestion) => {
    try {
      await handleAddItem(suggestion.name);
      setSuggestions(prev => prev.filter(s => s.name !== suggestion.name));
    } catch (err) {
      console.error('Error adding suggestion:', err);
    }
  };

  const handleAddFrequentItems = async (items: string[]) => {
    try {
      await Promise.all(items.map(item => handleAddItem(item)));
    } catch (err) {
      console.error('Error adding frequent items:', err);
    }
  };

  const handleSaveTemplate = async () => {
    if (!list || !newTemplateName) return;

    try {
      // Simulate API call - replace with actual backend call
      const newTemplate: ListTemplate = {
        id: Date.now().toString(),
        name: newTemplateName,
        description: newTemplateDescription,
        items: list.items.map(item => ({
          name: item.name,
          category: item.category,
          amount: item.amount,
          unit: item.unit,
        })),
        usageCount: 0,
      };
      setTemplates(prev => [...prev, newTemplate]);
      setSaveTemplateDialogOpen(false);
      setNewTemplateName('');
      setNewTemplateDescription('');
    } catch (err) {
      console.error('Error saving template:', err);
    }
  };

  const handleApplyTemplate = async (template: ListTemplate) => {
    try {
      await Promise.all(
        template.items.map(item =>
          handleAddItem(item.name)
        )
      );
      setTemplateDialogOpen(false);
    } catch (err) {
      console.error('Error applying template:', err);
    }
  };

  const handleAddFromMealPlan = async (mealPlan: MealPlan) => {
    try {
      // Simulate getting ingredients from recipes - replace with actual API call
      const mockIngredients = [
        { name: 'Ground Beef', amount: 1, unit: 'pound', category: 'Meat' },
        { name: 'Pasta', amount: 2, unit: 'box', category: 'Pasta & Grains' },
        { name: 'Tomato Sauce', amount: 2, unit: 'jar', category: 'Canned Goods' },
      ];

      await Promise.all(
        mockIngredients.map(item =>
          handleAddItem(item.name)
        )
      );
      setMealPlanDialogOpen(false);
    } catch (err) {
      console.error('Error adding meal plan items:', err);
    }
  };

  const fetchItemDetails = async (itemId: string) => {
    try {
      // Simulate API call - replace with actual backend call
      const mockDetails: ItemDetails = {
        ...editingItem!,
        nutritionalInfo: {
          calories: 120,
          protein: 3,
          carbs: 22,
          fat: 4,
          fiber: 2,
          sugar: 8,
          servingSize: {
            amount: 100,
            unit: 'g',
          },
        },
        organic: true,
        allergens: ['Gluten', 'Dairy'],
        alternatives: [
          { name: 'Organic Alternative', price: 4.99, organic: true },
          { name: 'Budget Option', price: 2.99, organic: false },
        ],
      };
      setEditingItemDetails(mockDetails);
    } catch (err) {
      console.error('Error fetching item details:', err);
    }
  };

  const handleEditItem = (item: ShoppingListItem) => {
    setEditingItem(item);
    setEditingItemDetails(null);
    setServingCount(1);
    setSelectedUnit(item.unit);
    fetchItemDetails(item._id.toString());
  };

  const handleUnitChange = (unit: string) => {
    setSelectedUnit(unit);
    if (editingItem) {
      // Simulate unit conversion - replace with actual conversion logic
      const conversionRates: Record<string, number> = {
        g: 1,
        kg: 1000,
        oz: 28.35,
        lb: 453.6,
        ml: 1,
        l: 1000,
        cup: 240,
        tbsp: 15,
        tsp: 5,
      };

      const oldAmount = editingItem.amount;
      const oldRate = conversionRates[editingItem.unit] || 1;
      const newRate = conversionRates[unit] || 1;
      const newAmount = (oldAmount * oldRate) / newRate;

      setEditingItem(prev => prev ? {
        ...prev,
        amount: Math.round(newAmount * 100) / 100,
        unit,
      } : null);
    }
  };

  const handleServingChange = (servings: number) => {
    setServingCount(servings);
    if (editingItem) {
      const scaleFactor = servings;
      setEditingItem(prev => prev ? {
        ...prev,
        amount: Math.round((prev.amount * scaleFactor) * 100) / 100,
      } : null);
    }
  };

  const calculateNutritionalInfo = (amount: number, unit: string, info: NutritionalInfo) => {
    // Simulate conversion to base unit (g/ml) - replace with actual conversion logic
    const conversionRates: Record<string, number> = {
      g: 1,
      kg: 1000,
      oz: 28.35,
      lb: 453.6,
      ml: 1,
      l: 1000,
      cup: 240,
      tbsp: 15,
      tsp: 5,
    };

    const baseAmount = amount * (conversionRates[unit] || 1);
    const servingRatio = baseAmount / info.servingSize.amount;

    return {
      calories: Math.round(info.calories * servingRatio),
      protein: Math.round(info.protein * servingRatio * 10) / 10,
      carbs: Math.round(info.carbs * servingRatio * 10) / 10,
      fat: Math.round(info.fat * servingRatio * 10) / 10,
      fiber: info.fiber ? Math.round(info.fiber * servingRatio * 10) / 10 : undefined,
      sugar: info.sugar ? Math.round(info.sugar * servingRatio * 10) / 10 : undefined,
    };
  };

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const rawData = await shoppingListService.getListStats(listId) as RawListStats;
      const now = new Date();
      const systemUser = {
        _id: new ObjectId(),
        name: 'System',
      };

      // Transform raw data to match ListStatsResponse type
      const data: ListStatsResponse = {
        ...rawData,
        items: (rawData.items || []).map(item => ({
          ...item,
          tags: item.tags || [],
          _id: new ObjectId(),
          amount: 1,
          unit: 'piece',
          addedBy: systemUser,
          updatedAt: now,
          createdAt: now,
          checked: false,
        } as ExtendedShoppingListItem)),
      };
      
      // Transform the data to match ListAnalytics interface
      setAnalytics({
        totalItems: data.totalItems,
        checkedItems: data.checkedItems,
        totalPrice: data.totalPrice,
        averageItemPrice: data.totalPrice / data.totalItems,
        mostExpensiveItems: data.items.slice(0, 5).map(item => ({
          name: item.name,
          price: item.price || 0,
        })),
        categoriesBreakdown: Object.entries(
          data.items.reduce((acc: Record<string, { count: number; totalPrice: number }>, item) => {
            const category = item.category || 'Uncategorized';
            if (!acc[category]) {
              acc[category] = { count: 0, totalPrice: 0 };
            }
            acc[category].count++;
            acc[category].totalPrice += item.price || 0;
            return acc;
          }, {})
        ).map(([category, categoryData]) => ({
          category,
          count: categoryData.count,
          totalPrice: categoryData.totalPrice,
        })),
        dietaryBreakdown: {
          vegetarian: data.items.filter(item => !item.tags?.includes('non-vegetarian')).length,
          vegan: data.items.filter(item => !item.tags?.includes('non-vegan')).length,
          glutenFree: data.items.filter(item => !item.tags?.includes('contains-gluten')).length,
          dairyFree: data.items.filter(item => !item.tags?.includes('contains-dairy')).length,
          nutFree: data.items.filter(item => !item.tags?.includes('contains-nuts')).length,
        },
        priceHistory: data.priceHistory,
        savingsOpportunities: data.items
          .map(item => ({
            item: item.name,
            potentialSavings: (item.price || 0) * 0.2,
            alternativeStore: 'Budget Store',
          }))
          .filter(opportunity => opportunity.potentialSavings > 0)
          .slice(0, 5),
      });
    } catch (error) {
      console.error('Error fetching analytics:', error);
      setError('Failed to load list analytics');
    } finally {
      setLoading(false);
    }
  };

  const checkDietaryCompliance = () => {
    if (!list || !showDietaryWarnings) return;

    const warnings = (list.items as ExtendedShoppingListItem[]).filter(item => {
      if (dietaryPreferences.vegetarian && item.tags?.includes('non-vegetarian')) {
        return true;
      }
      if (dietaryPreferences.vegan && item.tags?.includes('non-vegan')) {
        return true;
      }
      if (dietaryPreferences.glutenFree && item.tags?.includes('contains-gluten')) {
        return true;
      }
      if (dietaryPreferences.dairyFree && item.tags?.includes('contains-dairy')) {
        return true;
      }
      if (dietaryPreferences.nutFree && item.tags?.includes('contains-nuts')) {
        return true;
      }
      return dietaryPreferences.allergies.some(allergy => 
        item.tags?.includes(`contains-${allergy.toLowerCase()}`)
      );
    });

    if (warnings.length > 0) {
      setError(`Warning: Some items may not meet your dietary preferences: ${
        warnings.map(item => item.name).join(', ')
      }`);
    }
  };

  const handleUpdateDietaryPreferences = async (newPreferences: Partial<DietaryPreferences>) => {
    const updated = { ...dietaryPreferences, ...newPreferences };
    setDietaryPreferences(updated);
    // Store preferences locally since the backend method doesn't exist
    localStorage.setItem(`dietary-preferences-${listId}`, JSON.stringify(updated));
  };

  const renderAnalytics = () => {
    if (!analytics) return null;

    return (
      <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
        <Stack spacing={3}>
          <Typography variant="h6">List Analytics</Typography>
          
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  Progress
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={(analytics.checkedItems / analytics.totalItems) * 100}
                  sx={{ mt: 1, mb: 0.5 }}
                />
                <Typography variant="body2">
                  {analytics.checkedItems} of {analytics.totalItems} items checked
                </Typography>
              </Box>
            </Grid>

            <Grid item xs={12} md={6}>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  Total Price
                </Typography>
                <Typography variant="h4" color="primary">
                  ${analytics.totalPrice.toFixed(2)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Avg. ${analytics.averageItemPrice.toFixed(2)} per item
                </Typography>
              </Box>
            </Grid>

            <Grid item xs={12}>
              <Divider />
            </Grid>

            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" color="text.secondary">
                Category Breakdown
              </Typography>
              <List dense>
                {analytics.categoriesBreakdown.map(category => (
                  <ListItem key={category.category}>
                    <ListItemText
                      primary={category.category}
                      secondary={`${category.count} items · $${category.totalPrice.toFixed(2)}`}
                    />
                    <LinearProgress
                      variant="determinate"
                      value={(category.count / analytics.totalItems) * 100}
                      sx={{ width: 100, ml: 2 }}
                    />
                  </ListItem>
                ))}
              </List>
            </Grid>

            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" color="text.secondary">
                Dietary Breakdown
              </Typography>
              <List dense>
                {Object.entries(analytics.dietaryBreakdown).map(([diet, count]) => (
                  <ListItem key={diet}>
                    <ListItemText
                      primary={diet.replace(/([A-Z])/g, ' $1').trim()}
                      secondary={`${count} items`}
                    />
                    <LinearProgress
                      variant="determinate"
                      value={(count / analytics.totalItems) * 100}
                      sx={{ width: 100, ml: 2 }}
                    />
                  </ListItem>
                ))}
              </List>
            </Grid>

            <Grid item xs={12}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Potential Savings
              </Typography>
              <List dense>
                {analytics.savingsOpportunities.map(opportunity => (
                  <ListItem key={opportunity.item}>
                    <ListItemText
                      primary={opportunity.item}
                      secondary={`Save $${opportunity.potentialSavings.toFixed(2)} at ${opportunity.alternativeStore}`}
                    />
                    <Button size="small" variant="outlined">
                      View Details
                    </Button>
                  </ListItem>
                ))}
              </List>
            </Grid>
          </Grid>
        </Stack>
      </Paper>
    );
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !list) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error || 'List not found'}
      </Alert>
    );
  }

  return (
    <Paper elevation={3} sx={{ p: 3 }}>
      <Stack spacing={3}>
        {/* Header */}
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h5">
            {list.name}
          </Typography>
          <Stack direction="row" spacing={1}>
            {onPriceCompare && (
              <Tooltip title="Compare prices">
                <IconButton onClick={onPriceCompare} color="primary">
                  <PriceIcon />
                </IconButton>
              </Tooltip>
            )}
            <Tooltip title="Share list">
              <IconButton onClick={() => setShareDialogOpen(true)}>
                <ShareIcon />
              </IconButton>
            </Tooltip>
            <IconButton onClick={(e) => setMenuAnchor(e.currentTarget)}>
              <MoreIcon />
            </IconButton>
          </Stack>
        </Box>

        {/* Statistics */}
        {stats && (
          <Grid container spacing={2}>
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary">
                    Total Items
                  </Typography>
                  <Typography variant="h4">
                    {stats.totalItems}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary">
                    Completed
                  </Typography>
                  <Typography variant="h4">
                    {Math.round((stats.checkedItems / stats.totalItems) * 100)}%
                  </Typography>
                  <LinearProgress 
                    variant="determinate" 
                    value={(stats.checkedItems / stats.totalItems) * 100}
                    sx={{ mt: 1 }}
                  />
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary">
                    Most Added Item
                  </Typography>
                  <Typography variant="h6">
                    {stats.mostFrequentItems[0]?.name || 'N/A'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Added {stats.mostFrequentItems[0]?.count || 0} times
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary">
                    Average Price
                  </Typography>
                  <Typography variant="h4">
                    {new Intl.NumberFormat('en-US', {
                      style: 'currency',
                      currency: 'USD', // TODO: Get from settings
                    }).format(stats.totalPrice / stats.totalItems)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}

        {/* Smart Suggestions */}
        {suggestions.length > 0 && (
          <Card>
            <CardContent>
              <Stack spacing={2}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <SuggestionIcon color="primary" />
                  <Typography variant="h6">Smart Suggestions</Typography>
                </Stack>
                <Grid container spacing={1}>
                  {suggestions.map((suggestion) => (
                    <Grid item xs={12} sm={6} md={4} key={suggestion.name}>
                      <Card variant="outlined">
                        <CardContent>
                          <Stack spacing={1}>
                            <Typography variant="subtitle1">
                              {suggestion.name}
                            </Typography>
                            <Stack direction="row" justifyContent="space-between" alignItems="center">
                              <Chip
                                label={`${Math.round(suggestion.confidence * 100)}% match`}
                                size="small"
                                color={suggestion.confidence > 0.8 ? "success" : "primary"}
                              />
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={() => handleAddSuggestion(suggestion)}
                              >
                                Add
                              </Button>
                            </Stack>
                            <Typography variant="body2" color="text.secondary">
                              {suggestion.reason}
                            </Typography>
                          </Stack>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              </Stack>
            </CardContent>
          </Card>
        )}

        {/* Frequently Bought Together */}
        {frequentlyBoughtTogether.length > 0 && (
          <Card>
            <CardContent>
              <Stack spacing={2}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <BasketIcon color="primary" />
                  <Typography variant="h6">Frequently Bought Together</Typography>
                </Stack>
                <Grid container spacing={2}>
                  {frequentlyBoughtTogether.map((group, index) => (
                    <Grid item xs={12} key={index}>
                      <Card variant="outlined">
                        <CardContent>
                          <Stack spacing={2}>
                            <Stack direction="row" spacing={1} alignItems="center">
                              {group.items.map((item, i) => (
                                <React.Fragment key={item}>
                                  <Typography>{item}</Typography>
                                  {i < group.items.length - 1 && (
                                    <Typography color="text.secondary">+</Typography>
                                  )}
                                </React.Fragment>
                              ))}
                            </Stack>
                            <Stack direction="row" justifyContent="space-between" alignItems="center">
                              <Stack direction="row" spacing={1}>
                                <Chip
                                  label={`${Math.round(group.frequency * 100)}% buy together`}
                                  size="small"
                                  color="primary"
                                />
                                <Chip
                                  icon={<SavingsIcon />}
                                  label={`Save ${new Intl.NumberFormat('en-US', {
                                    style: 'currency',
                                    currency: 'USD',
                                  }).format(group.totalSavings)}`}
                                  size="small"
                                  color="success"
                                />
                              </Stack>
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={() => handleAddFrequentItems(group.items)}
                              >
                                Add All
                              </Button>
                            </Stack>
                          </Stack>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              </Stack>
            </CardContent>
          </Card>
        )}

        {/* Filters and Sort */}
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <TextField
              select
              fullWidth
              size="small"
              label="Category Filter"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <MenuItem value="all">All Categories</MenuItem>
              {Array.from(getCategories()).map((category) => (
                <MenuItem key={category} value={category}>
                  {category}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              select
              fullWidth
              size="small"
              label="Sort By"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      onClick={() => setSortOrder(order => order === 'asc' ? 'desc' : 'asc')}
                    >
                      {sortOrder === 'asc' ? <ArrowUpward /> : <ArrowDownward />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            >
              <MenuItem value="date">Date Added</MenuItem>
              <MenuItem value="name">Name</MenuItem>
              <MenuItem value="category">Category</MenuItem>
              <MenuItem value="checked">Completion Status</MenuItem>
            </TextField>
          </Grid>
        </Grid>

        {/* Collaborators */}
        {list.collaborators.length > 0 && (
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Shared with
            </Typography>
            <Stack direction="row" spacing={1}>
              {list.collaborators.map((collaborator) => (
                <Chip
                  key={collaborator.userId.toString()}
                  label={`${collaborator.name} (${collaborator.role})`}
                  size="small"
                  onDelete={isOwner ? () => {
                    shoppingListService.removeCollaborator(
                      listId,
                      collaborator.userId.toString()
                    );
                  } : undefined}
                />
              ))}
            </Stack>
          </Box>
        )}

        {/* Add Item Form with Smart Suggestions */}
        {canEdit && (
          <Box component="form" onSubmit={(e) => {
            e.preventDefault();
            handleAddItem(newItem);
          }}>
            <Autocomplete
              freeSolo
              options={suggestions}
              getOptionLabel={(option) => 
                typeof option === 'string' ? option : option.name
              }
              renderOption={(props, option) => (
                <MenuItem {...props}>
                  <ListItemText
                    primary={option.name}
                    secondary={option.reason}
                  />
                  <Chip
                    label={`${Math.round(option.confidence * 100)}% match`}
                    size="small"
                    color={option.confidence > 0.8 ? "success" : "primary"}
                  />
                </MenuItem>
              )}
              renderInput={(params) => (
                <TextField
                  {...params}
                  fullWidth
                  placeholder="Add an item..."
                  value={newItem}
                  onChange={(e) => setNewItem(e.target.value)}
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {params.InputProps.endAdornment}
                        <InputAdornment position="end">
                          <IconButton type="submit">
                            <AddIcon />
                          </IconButton>
                        </InputAdornment>
                      </>
                    ),
                  }}
                />
              )}
            />
          </Box>
        )}

        {/* Items List */}
        <List>
          {getSortedAndFilteredItems().map((item) => (
            <ListItem
              key={item._id.toString()}
              divider
              secondaryAction={canEdit && (
                <Stack direction="row" spacing={1}>
                  <IconButton
                    edge="end"
                    onClick={() => handleEditItem(item)}
                  >
                    <EditIcon />
                  </IconButton>
                  <IconButton
                    edge="end"
                    onClick={() => handleDeleteItem(item._id.toString())}
                  >
                    <DeleteIcon />
                  </IconButton>
                </Stack>
              )}
            >
              <ListItemText
                primary={
                  <Typography
                    sx={{
                      textDecoration: item.checked ? 'line-through' : 'none',
                      color: item.checked ? 'text.secondary' : 'text.primary',
                    }}
                  >
                    {item.name}
                  </Typography>
                }
                secondary={
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="body2" color="text.secondary">
                      {item.amount} {item.unit}
                    </Typography>
                    {item.category && (
                      <Chip
                        icon={<CategoryIcon />}
                        label={item.category}
                        size="small"
                        variant="outlined"
                      />
                    )}
                  </Stack>
                }
              />
              <Checkbox
                edge="start"
                checked={item.checked}
                onChange={() => handleToggleItem(item)}
                disabled={!canEdit}
              />
            </ListItem>
          ))}
        </List>

        {/* Menu */}
        <Menu
          anchorEl={menuAnchor}
          open={Boolean(menuAnchor)}
          onClose={() => setMenuAnchor(null)}
        >
          <MenuItem onClick={() => {
            setMenuAnchor(null);
            setSortBy('name');
            setSortOrder('asc');
          }}>
            <ListItemText primary="Sort by name" />
            <SortIcon />
          </MenuItem>
          <MenuItem onClick={() => {
            setMenuAnchor(null);
            setSortBy('category');
            setSortOrder('asc');
          }}>
            <ListItemText primary="Sort by category" />
            <CategoryIcon />
          </MenuItem>
          <MenuItem onClick={() => {
            setMenuAnchor(null);
            setSortBy('checked');
            setSortOrder('asc');
          }}>
            <ListItemText primary="Sort by status" />
            <CheckBoxIcon />
          </MenuItem>
          {isOwner && (
            <MenuItem onClick={() => {
              setMenuAnchor(null);
              // TODO: Implement delete list
            }}>
              <ListItemText primary="Delete list" />
              <DeleteIcon />
            </MenuItem>
          )}
        </Menu>

        {/* Share Dialog */}
        <Dialog
          open={shareDialogOpen}
          onClose={() => setShareDialogOpen(false)}
        >
          <DialogTitle>Share List</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                fullWidth
                label="Email"
                value={collaboratorEmail}
                onChange={(e) => setCollaboratorEmail(e.target.value)}
              />
              <TextField
                select
                fullWidth
                label="Role"
                value={collaboratorRole}
                onChange={(e) => setCollaboratorRole(e.target.value as 'editor' | 'viewer')}
              >
                <MenuItem value="editor">Editor</MenuItem>
                <MenuItem value="viewer">Viewer</MenuItem>
              </TextField>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShareDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddCollaborator}
              variant="contained"
              disabled={!collaboratorEmail.trim()}
            >
              Share
            </Button>
          </DialogActions>
        </Dialog>

        {/* Edit Item Dialog */}
        <Dialog
          open={!!editingItem}
          onClose={() => {
            setEditingItem(null);
            setEditingItemDetails(null);
          }}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>Edit Item</DialogTitle>
          <DialogContent>
            <Stack spacing={3} sx={{ mt: 1 }}>
              {/* Basic Information */}
              <TextField
                fullWidth
                label="Item Name"
                value={editingItem?.name || ''}
                onChange={(e) => setEditingItem(prev =>
                  prev ? { ...prev, name: e.target.value } : null
                )}
              />

              {/* Amount and Unit Selection */}
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Amount and Unit
                </Typography>
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Amount"
                      value={editingItem?.amount || ''}
                      onChange={(e) => setEditingItem(prev =>
                        prev ? { ...prev, amount: Number(e.target.value) } : null
                      )}
                      InputProps={{
                        inputProps: { min: 0, step: 0.1 }
                      }}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <ToggleButtonGroup
                      value={selectedUnit}
                      exclusive
                      onChange={(_, value) => value && handleUnitChange(value)}
                      fullWidth
                    >
                      {['g', 'kg', 'oz', 'lb', 'ml', 'l', 'cup', 'tbsp', 'tsp'].map(unit => (
                        <ToggleButton key={unit} value={unit}>
                          {unit}
                        </ToggleButton>
                      ))}
                    </ToggleButtonGroup>
                  </Grid>
                </Grid>
              </Box>

              {/* Serving Size Scaling */}
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Scale Recipe
                </Typography>
                <Stack spacing={2}>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <ServingIcon />
                    <Typography>
                      Servings: {servingCount}
                    </Typography>
                  </Stack>
                  <Slider
                    value={servingCount}
                    onChange={(_, value) => handleServingChange(value as number)}
                    min={1}
                    max={20}
                    marks={[
                      { value: 1, label: '1' },
                      { value: 5, label: '5' },
                      { value: 10, label: '10' },
                      { value: 15, label: '15' },
                      { value: 20, label: '20' },
                    ]}
                  />
                </Stack>
              </Box>

              {/* Nutritional Information */}
              {editingItemDetails?.nutritionalInfo && (
                <Accordion
                  expanded={showNutritionalInfo}
                  onChange={() => setShowNutritionalInfo(!showNutritionalInfo)}
                >
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <NutritionIcon />
                      <Typography>Nutritional Information</Typography>
                      {editingItemDetails.organic && (
                        <Chip
                          icon={<OrganicIcon />}
                          label="Organic"
                          size="small"
                          color="success"
                        />
                      )}
                      {editingItemDetails.allergens && editingItemDetails.allergens.length > 0 && (
                        <Chip
                          icon={<AllergenIcon />}
                          label={`${editingItemDetails.allergens.length} Allergens`}
                          size="small"
                          color="warning"
                        />
                      )}
                    </Stack>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Stack spacing={2}>
                      {/* Nutritional Table */}
                      <TableContainer>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell>Nutrient</TableCell>
                              <TableCell align="right">Amount</TableCell>
                              <TableCell align="right">% Daily Value</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {editingItem && editingItemDetails.nutritionalInfo && (
                              <>
                                {Object.entries(calculateNutritionalInfo(
                                  editingItem.amount,
                                  editingItem.unit,
                                  editingItemDetails.nutritionalInfo
                                )).map(([nutrient, value]) => {
                                  if (!value) return null;
                                  const dailyValues: Record<string, number> = {
                                    calories: 2000,
                                    protein: 50,
                                    carbs: 275,
                                    fat: 78,
                                    fiber: 28,
                                    sugar: 50,
                                  };
                                  const dv = dailyValues[nutrient];
                                  return (
                                    <TableRow key={nutrient}>
                                      <TableCell component="th" scope="row" sx={{ textTransform: 'capitalize' }}>
                                        {nutrient}
                                      </TableCell>
                                      <TableCell align="right">
                                        {value}{nutrient === 'calories' ? '' : 'g'}
                                      </TableCell>
                                      <TableCell align="right">
                                        {dv ? `${Math.round((value / dv) * 100)}%` : '-'}
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                              </>
                            )}
                          </TableBody>
                        </Table>
                      </TableContainer>

                      {/* Allergens */}
                      {editingItemDetails.allergens && editingItemDetails.allergens.length > 0 && (
                        <Box>
                          <Typography variant="subtitle2" gutterBottom>
                            Allergens
                          </Typography>
                          <Stack direction="row" spacing={1}>
                            {editingItemDetails.allergens.map(allergen => (
                              <Chip
                                key={allergen}
                                label={allergen}
                                size="small"
                                color="warning"
                                variant="outlined"
                              />
                            ))}
                          </Stack>
                        </Box>
                      )}

                      {/* Alternative Products */}
                      {editingItemDetails.alternatives && editingItemDetails.alternatives.length > 0 && (
                        <Box>
                          <Typography variant="subtitle2" gutterBottom>
                            Alternative Products
                          </Typography>
                          <Stack spacing={1}>
                            {editingItemDetails.alternatives.map((alt, index) => (
                              <Card variant="outlined" key={index}>
                                <CardContent>
                                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                                    <Stack direction="row" spacing={1} alignItems="center">
                                      <Typography variant="body2">
                                        {alt.name}
                                      </Typography>
                                      {alt.organic && (
                                        <Chip
                                          icon={<OrganicIcon />}
                                          label="Organic"
                                          size="small"
                                          color="success"
                                        />
                                      )}
                                    </Stack>
                                    <Typography variant="body2" color="primary">
                                      ${alt.price.toFixed(2)}
                                    </Typography>
                                  </Stack>
                                </CardContent>
                              </Card>
                            ))}
                          </Stack>
                        </Box>
                      )}
                    </Stack>
                  </AccordionDetails>
                </Accordion>
              )}

              {/* Category and Notes */}
              <TextField
                fullWidth
                label="Category"
                value={editingItem?.category || ''}
                onChange={(e) => setEditingItem(prev =>
                  prev ? { ...prev, category: e.target.value } : null
                )}
              />
              <TextField
                fullWidth
                multiline
                rows={2}
                label="Notes"
                value={editingItem?.notes || ''}
                onChange={(e) => setEditingItem(prev =>
                  prev ? { ...prev, notes: e.target.value } : null
                )}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => {
              setEditingItem(null);
              setEditingItemDetails(null);
            }}>
              Cancel
            </Button>
            <Button
              onClick={handleUpdateItem}
              variant="contained"
              disabled={!editingItem?.name}
            >
              Save
            </Button>
          </DialogActions>
        </Dialog>

        {/* Quick Actions Speed Dial */}
        <SpeedDial
          ariaLabel="Shopping List Actions"
          sx={{ position: 'fixed', bottom: 16, right: 16 }}
          icon={<SpeedDialIcon />}
        >
          <SpeedDialAction
            icon={<TemplateIcon />}
            tooltipTitle="Use Template"
            onClick={() => setTemplateDialogOpen(true)}
          />
          <SpeedDialAction
            icon={<SaveTemplateIcon />}
            tooltipTitle="Save as Template"
            onClick={() => setSaveTemplateDialogOpen(true)}
          />
          <SpeedDialAction
            icon={<CalendarIcon />}
            tooltipTitle="Add from Meal Plan"
            onClick={() => setMealPlanDialogOpen(true)}
          />
        </SpeedDial>

        {/* Templates Dialog */}
        <Dialog
          open={templateDialogOpen}
          onClose={() => setTemplateDialogOpen(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>Shopping List Templates</DialogTitle>
          <DialogContent>
            <Grid container spacing={2}>
              {templates.map((template) => (
                <Grid item xs={12} sm={6} key={template.id}>
                  <Card variant="outlined">
                    <CardContent>
                      <Stack spacing={2}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Typography variant="h6">{template.name}</Typography>
                          <Chip
                            icon={<BookmarkIcon />}
                            label={`Used ${template.usageCount} times`}
                            size="small"
                          />
                        </Stack>
                        <Typography color="text.secondary">
                          {template.description}
                        </Typography>
                        <Box>
                          <Typography variant="subtitle2" gutterBottom>
                            Items ({template.items.length})
                          </Typography>
                          <Stack direction="row" spacing={1} flexWrap="wrap">
                            {template.items.slice(0, 3).map((item) => (
                              <Chip
                                key={item.name}
                                label={item.name}
                                size="small"
                                variant="outlined"
                              />
                            ))}
                            {template.items.length > 3 && (
                              <Chip
                                label={`+${template.items.length - 3} more`}
                                size="small"
                              />
                            )}
                          </Stack>
                        </Box>
                        <Button
                          variant="contained"
                          onClick={() => handleApplyTemplate(template)}
                        >
                          Use Template
                        </Button>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setTemplateDialogOpen(false)}>Cancel</Button>
          </DialogActions>
        </Dialog>

        {/* Save Template Dialog */}
        <Dialog
          open={saveTemplateDialogOpen}
          onClose={() => setSaveTemplateDialogOpen(false)}
        >
          <DialogTitle>Save as Template</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                label="Template Name"
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                fullWidth
              />
              <TextField
                label="Description"
                value={newTemplateDescription}
                onChange={(e) => setNewTemplateDescription(e.target.value)}
                multiline
                rows={3}
                fullWidth
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setSaveTemplateDialogOpen(false)}>Cancel</Button>
            <Button
              variant="contained"
              onClick={handleSaveTemplate}
              disabled={!newTemplateName}
            >
              Save Template
            </Button>
          </DialogActions>
        </Dialog>

        {/* Meal Plan Dialog */}
        <Dialog
          open={mealPlanDialogOpen}
          onClose={() => setMealPlanDialogOpen(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>Add from Meal Plan</DialogTitle>
          <DialogContent>
            <List>
              {mealPlans.map((plan) => (
                <ListItemButton
                  key={plan.id}
                  onClick={() => handleAddFromMealPlan(plan)}
                >
                  <ListItemAvatar>
                    <AvatarGroup max={3} sx={{ mr: 2 }}>
                      {plan.recipes.map((recipe) => (
                        <Avatar
                          key={recipe.id}
                          src={recipe.image}
                          alt={recipe.name}
                        />
                      ))}
                    </AvatarGroup>
                  </ListItemAvatar>
                  <ListItemText
                    primary={plan.name}
                    secondary={
                      <Stack direction="row" spacing={1} alignItems="center">
                        <CalendarIcon fontSize="small" />
                        <Typography variant="body2">
                          {new Date(plan.date).toLocaleDateString()}
                        </Typography>
                        <ServingsIcon fontSize="small" />
                        <Typography variant="body2">
                          {plan.recipes.reduce((sum, r) => sum + r.servings, 0)} servings
                        </Typography>
                      </Stack>
                    }
                  />
                </ListItemButton>
              ))}
            </List>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setMealPlanDialogOpen(false)}>Cancel</Button>
          </DialogActions>
        </Dialog>

        <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
          <Button
            variant="outlined"
            startIcon={<AnalyticsIcon />}
            onClick={() => {
              setShowAnalytics(!showAnalytics);
              if (!analytics) fetchAnalytics();
            }}
          >
            {showAnalytics ? 'Hide Analytics' : 'Show Analytics'}
          </Button>
          <Button
            variant="outlined"
            startIcon={<RestaurantIcon />}
            onClick={() => setDietaryDialogOpen(true)}
          >
            Dietary Preferences
          </Button>
        </Stack>

        {showAnalytics && renderAnalytics()}

        {/* Dietary Preferences Dialog */}
        <Dialog open={dietaryDialogOpen} onClose={() => setDietaryDialogOpen(false)}>
          <DialogTitle>Dietary Preferences</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 2 }}>
              <FormGroup>
                {Object.entries(dietaryPreferences).map(([key, value]) => {
                  if (typeof value === 'boolean') {
                    return (
                      <FormControlLabel
                        key={key}
                        control={
                          <Switch
                            checked={value}
                            onChange={(e) => handleUpdateDietaryPreferences({
                              [key]: e.target.checked
                            })}
                          />
                        }
                        label={key.replace(/([A-Z])/g, ' $1').trim()}
                      />
                    );
                  }
                  return null;
                })}
              </FormGroup>

              <Autocomplete
                multiple
                options={commonAllergies}
                value={dietaryPreferences.allergies}
                onChange={(_, newValue) => handleUpdateDietaryPreferences({
                  allergies: newValue
                })}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Allergies"
                    placeholder="Add allergies"
                  />
                )}
              />

              <Autocomplete
                multiple
                freeSolo
                options={[]}
                value={dietaryPreferences.excludedIngredients}
                onChange={(_, newValue) => handleUpdateDietaryPreferences({
                  excludedIngredients: newValue
                })}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Excluded Ingredients"
                    placeholder="Add ingredients to exclude"
                  />
                )}
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={showDietaryWarnings}
                    onChange={(e) => setShowDietaryWarnings(e.target.checked)}
                  />
                }
                label="Show dietary warnings"
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDietaryDialogOpen(false)}>Close</Button>
          </DialogActions>
        </Dialog>
      </Stack>
    </Paper>
  );
}; 