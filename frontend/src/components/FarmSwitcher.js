import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Plus, Tractor } from 'lucide-react';
import { toast } from 'sonner';
import { useFarm } from '@/contexts/FarmContext';

export const FarmSwitcher = ({ light = false }) => {
  const { farms, currentFarm, selectFarm } = useFarm();
  const { t } = useTranslation();
  const navigate = useNavigate();

  if (!currentFarm) return null;

  const handleChange = (id) => {
    selectFarm(id);
    const farm = farms.find((f) => f.id === id);
    toast.success(t('common.farm_switched', { name: farm?.name }));
  };

  return (
    <div className="flex items-center gap-2" data-testid="farm-switcher">
      <Select value={currentFarm.id} onValueChange={handleChange}>
        <SelectTrigger
          className={`h-11 min-w-[160px] max-w-[240px] rounded-full ${light ? 'bg-white/15 border-white/30 text-white' : ''}`}
          data-testid="farm-switcher-select"
        >
          <Tractor className="w-4 h-4 mr-1 flex-shrink-0" />
          <SelectValue placeholder={t('common.select_farm')} />
        </SelectTrigger>
        <SelectContent>
          {farms.map((f) => (
            <SelectItem key={f.id} value={f.id} data-testid={`farm-option-${f.id}`}>
              {f.name} · {f.crop_type}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        variant={light ? 'secondary' : 'outline'}
        size="icon"
        className="rounded-full h-11 w-11 flex-shrink-0"
        onClick={() => navigate('/farm-setup')}
        title={t('common.add_farm')}
        data-testid="add-farm-button"
      >
        <Plus className="w-5 h-5" />
      </Button>
    </div>
  );
};
